import { spawnSync } from 'child_process';
import { homedir } from 'os';
import path from 'path';
import { resolveDailyagentCommand } from '../utils/process.js';

const TASK_PREFIX = 'DailyAgent_';
const DAILYAGENT_HOME = path.join(homedir(), '.dailyagent');
const LOGS_DIR = path.join(DAILYAGENT_HOME, 'logs');

/**
 * Windows 작업 스케줄러 태스크 이름을 생성합니다.
 */
function taskName(jobName: string): string {
  return `${TASK_PREFIX}${jobName}`;
}

/**
 * schtasks.exe를 실행합니다.
 */
function runSchtasks(args: string[]): { stdout: string; stderr: string; status: number | null; error?: Error } {
  const result = spawnSync('schtasks.exe', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
    error: result.error
  };
}

/**
 * cron 스케줄(5필드)을 schtasks 트리거 파라미터로 변환합니다.
 * 지원 패턴:
 *   - 매분: * * * * *  → /SC MINUTE /MO 1
 *   - N분마다: *\/N * * * * → /SC MINUTE /MO N
 *   - 매시간: 0 * * * * → /SC HOURLY /MO 1
 *   - 매일 특정 시각: M H * * * → /SC DAILY /MO 1 /ST HH:MM
 *   - 매주 특정 요일: M H * * D → /SC WEEKLY /MO 1 /D DOW /ST HH:MM
 */
function cronToSchtasksArgs(schedule: string): string[] {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`잘못된 cron 스케줄 형식: "${schedule}" (5개 필드 필요)`);
  }

  const [minute, hour, , , weekday] = parts;

  // 매분 실행: * * * * *
  if (minute === '*' && hour === '*') {
    return ['/SC', 'MINUTE', '/MO', '1'];
  }

  // N분마다: */N * * * *
  const minuteStep = minute!.match(/^\*\/(\d+)$/);
  if (minuteStep && hour === '*') {
    return ['/SC', 'MINUTE', '/MO', minuteStep[1]!];
  }

  // 매일/매주: M H * * * 또는 M H * * D
  const minuteNum = parseInt(minute!, 10);
  const hourNum = parseInt(hour!, 10);

  if (!isNaN(minuteNum) && !isNaN(hourNum)) {
    const startTime = `${String(hourNum).padStart(2, '0')}:${String(minuteNum).padStart(2, '0')}`;

    // 특정 요일 지정: M H * * D
    if (weekday !== '*') {
      const dowMap: Record<string, string> = {
        '0': 'SUN', '7': 'SUN',
        '1': 'MON', '2': 'TUE', '3': 'WED',
        '4': 'THU', '5': 'FRI', '6': 'SAT'
      };
      const dow = dowMap[weekday!] ?? 'MON';
      return ['/SC', 'WEEKLY', '/MO', '1', '/D', dow, '/ST', startTime];
    }

    // 매일 특정 시각
    return ['/SC', 'DAILY', '/MO', '1', '/ST', startTime];
  }

  // 폴백: 매일 00:00
  return ['/SC', 'DAILY', '/MO', '1', '/ST', '00:00'];
}

/**
 * Windows 작업 스케줄러에 job을 등록합니다.
 */
export function installSchtasksJob(jobName: string, schedule: string): void {
  const name = taskName(jobName);
  const cmd = resolveDailyagentCommand();
  const logFile = path.join(LOGS_DIR, `${jobName}-schtasks.log`);

  // 기존 태스크가 있으면 먼저 삭제
  if (isSchtasksJobInstalled(jobName)) {
    uninstallSchtasksJob(jobName);
  }

  const scheduleArgs = cronToSchtasksArgs(schedule);

  // cmd.exe로 실행하여 로그 파일에 출력 리디렉션
  const taskRun = `cmd.exe /C "${cmd} run ${jobName} >> "${logFile}" 2>&1"`;

  const args = [
    '/Create',
    '/TN', name,
    '/TR', taskRun,
    ...scheduleArgs,
    '/F'
  ];

  const result = runSchtasks(args);

  if (result.error) {
    throw new Error(`schtasks 등록 실행 실패: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status ?? 'unknown'}`;
    throw new Error(`schtasks 등록 실패: ${detail}`);
  }
}

/**
 * Windows 작업 스케줄러에서 job을 제거합니다.
 */
export function uninstallSchtasksJob(jobName: string): void {
  const name = taskName(jobName);

  const result = runSchtasks(['/Delete', '/TN', name, '/F']);

  if (result.error) {
    throw new Error(`schtasks 삭제 실행 실패: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status ?? 'unknown'}`;
    throw new Error(`작업 "${jobName}"의 schtasks 항목을 찾을 수 없습니다: ${detail}`);
  }
}

/**
 * 특정 job의 Windows 작업 스케줄러 등록 여부를 확인합니다.
 */
export function isSchtasksJobInstalled(jobName: string): boolean {
  const name = taskName(jobName);
  const result = runSchtasks(['/Query', '/TN', name]);
  return !result.error && result.status === 0;
}

/**
 * 등록된 모든 dailyagent schtasks 항목을 조회합니다.
 */
export function listSchtasksJobs(): Array<{ jobName: string; schedule: string; taskName: string }> {
  const results: Array<{ jobName: string; schedule: string; taskName: string }> = [];

  const result = runSchtasks(['/Query', '/FO', 'CSV', '/NH']);
  if (result.error || result.status !== 0) return results;

  const lines = result.stdout.split('\n').filter((l) => l.trim().length > 0);

  for (const line of lines) {
    // CSV 형식: "TaskName","NextRunTime","Status"
    const csvMatch = line.match(/^"([^"]+)"/);
    if (!csvMatch) continue;

    const fullName = csvMatch[1]!.replace(/\\/g, '/').split('/').pop() ?? '';
    if (!fullName.startsWith(TASK_PREFIX)) continue;

    const jobName = fullName.slice(TASK_PREFIX.length);

    // 스케줄 정보 조회
    const schedule = querySchtasksSchedule(jobName);
    results.push({ jobName, schedule, taskName: fullName });
  }

  return results;
}

/**
 * 특정 job의 스케줄 정보를 조회합니다.
 */
function querySchtasksSchedule(jobName: string): string {
  const name = taskName(jobName);
  const result = runSchtasks(['/Query', '/TN', name, '/FO', 'LIST', '/V']);

  if (result.error || result.status !== 0) return '알 수 없음';

  // "Schedule Type:" 라인에서 스케줄 타입 추출
  const typeMatch = result.stdout.match(/Schedule Type:\s*(.+)/i);
  const startMatch = result.stdout.match(/Start Time:\s*(.+)/i);
  const daysMatch = result.stdout.match(/Days:\s*(.+)/i);

  const scheduleType = typeMatch?.[1]?.trim() ?? '';
  const startTime = startMatch?.[1]?.trim() ?? '';
  const days = daysMatch?.[1]?.trim() ?? '';

  if (scheduleType && startTime) {
    return days ? `${scheduleType} ${days} ${startTime}` : `${scheduleType} ${startTime}`;
  }

  return scheduleType || '알 수 없음';
}

/**
 * schtasks.exe 사용 가능 여부를 확인합니다. (Windows 네이티브 전용)
 */
export function isSchtasksAvailable(): boolean {
  const result = runSchtasks(['/?']);
  return !result.error;
}
