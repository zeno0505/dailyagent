import { spawnSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { LOGS_DIR } from '../config.js';
import { DEFAULT_ENV_PATH, isCommandAvailable, resolveDailyagentCommand } from '../utils/process.js';
import { cronToCalendarInterval } from '../utils/schedule.js';

const PLIST_PREFIX = 'com.dailyagent.job.';
const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents');

/**
 * plist 라벨을 생성합니다.
 */
function plistLabel(jobName: string): string {
  return `${PLIST_PREFIX}${jobName}`;
}

/**
 * plist 파일 경로를 반환합니다.
 */
function plistPath(jobName: string): string {
  return path.join(LAUNCH_AGENTS_DIR, `${plistLabel(jobName)}.plist`);
}

function runLaunchctl(action: 'load' | 'unload', filePath: string, ignoreFailure = false): void {
  const result = spawnSync('launchctl', [action, filePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (ignoreFailure && result.status !== 0) {
    return;
  }

  if (result.error) {
    throw new Error(`launchctl ${action} 실행 실패: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status ?? 'unknown'}`;
    throw new Error(`launchctl ${action} 실패: ${detail}`);
  }
}

/**
 * plist XML 내용을 생성합니다.
 */
function generatePlist(jobName: string, schedule: string): string {
  const label = plistLabel(jobName);
  const cmd = resolveDailyagentCommand();
  const intervals = cronToCalendarInterval(schedule);

  // 등록 시점의 PATH를 캡처하여 launchd 실행 환경에 주입
  // launchd는 ~/.zshrc를 소싱하지 않으므로 EnvironmentVariables로 명시적으로 제공
  const envPath = process.env.PATH || DEFAULT_ENV_PATH;
  const shell = process.env.SHELL || '/bin/bash';
  const programArgs = [shell, '-l', '-c', `export PATH="${envPath}"; ${cmd} run ${jobName}`];

  const programArgsXml = programArgs
    .map((arg) => `      <string>${escapeXml(arg)}</string>`)
    .join('\n');

  const intervalsXml = intervals
    .map((interval) => {
      const entries = Object.entries(interval)
        .map(([key, val]) => `        <key>${key}</key>\n        <integer>${val}</integer>`)
        .join('\n');
      return `      <dict>\n${entries}\n      </dict>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${escapeXml(label)}</string>
    <key>ProgramArguments</key>
    <array>
${programArgsXml}
    </array>
    <key>StartCalendarInterval</key>
    <array>
${intervalsXml}
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${escapeXml(envPath)}</string>
    </dict>
    <key>StandardOutPath</key>
    <string>${escapeXml(path.join(LOGS_DIR, `${jobName}-launchd.log`))}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(path.join(LOGS_DIR, `${jobName}-launchd.log`))}</string>
    <key>RunAtLoad</key>
    <false/>
    <key>X-DailyAgent-Schedule</key>
    <string>${escapeXml(schedule)}</string>
</dict>
</plist>
`;
}

/**
 * XML 특수문자를 이스케이프합니다.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * launchd에 job 스케줄을 등록합니다.
 */
export function installLaunchdJob(jobName: string, schedule: string): void {
  const filePath = plistPath(jobName);

  // 기존 항목이 있으면 먼저 제거
  if (existsSync(filePath)) {
    runLaunchctl('unload', filePath, true);
  }

  // plist 파일 생성
  const plistContent = generatePlist(jobName, schedule);
  writeFileSync(filePath, plistContent, 'utf8');

  // launchctl에 등록
  try {
    runLaunchctl('load', filePath);
  } catch (err) {
    // 파일은 생성했지만 load 실패 시 정리
    unlinkSync(filePath);
    throw new Error(`launchd 등록 실패: ${(err as Error).message}`);
  }
}

/**
 * launchd에서 job 스케줄을 제거합니다.
 */
export function uninstallLaunchdJob(jobName: string): void {
  const filePath = plistPath(jobName);

  if (!existsSync(filePath)) {
    throw new Error(`작업 "${jobName}"의 launchd 항목을 찾을 수 없습니다.`);
  }

  runLaunchctl('unload', filePath, true);

  unlinkSync(filePath);
}

/**
 * 특정 job의 launchd 등록 여부를 확인합니다.
 */
export function isLaunchdJobInstalled(jobName: string): boolean {
  return existsSync(plistPath(jobName));
}

/**
 * 등록된 모든 dailyagent launchd 항목을 조회합니다.
 */
export function listLaunchdJobs(): Array<{ jobName: string; schedule: string; plistFile: string }> {
  const results: Array<{ jobName: string; schedule: string; plistFile: string }> = [];

  if (!existsSync(LAUNCH_AGENTS_DIR)) return results;

  try {
    const files = readdirSync(LAUNCH_AGENTS_DIR).filter((f) => f.startsWith(PLIST_PREFIX) && f.endsWith('.plist'));

    for (const file of files) {
      const label = file.replace('.plist', '');
      const jobName = label.replace(PLIST_PREFIX, '');
      const filePath = path.join(LAUNCH_AGENTS_DIR, file);

      // plist에서 스케줄 정보 추출
      const schedule = extractScheduleFromPlist(filePath);
      results.push({ jobName, schedule, plistFile: filePath });
    }
  } catch {
    // 디렉토리 읽기 실패
  }

  return results;
}

/**
 * plist 파일에서 cron 스케줄 문자열을 복원합니다.
 * X-DailyAgent-Schedule 커스텀 키가 있으면 원본 표현식을 그대로 반환하고,
 * 없으면 StartCalendarInterval의 첫 번째 엔트리에서 역산합니다.
 */
function extractScheduleFromPlist(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf8');

    // 원본 스케줄 문자열이 저장된 경우 우선 사용
    const originalScheduleRegex = /<key>X-DailyAgent-Schedule<\/key>\s*<string>([^<]+)<\/string>/;
    const originalMatch = content.match(originalScheduleRegex);
    if (originalMatch) {
      return originalMatch[1]!
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
    }

    // 폴백: 첫 번째 interval 엔트리의 값으로 역산 (단순 고정값만 지원)
    const minute = extractPlistValue(content, 'Minute') ?? '*';
    const hour = extractPlistValue(content, 'Hour') ?? '*';
    const day = extractPlistValue(content, 'Day') ?? '*';
    const month = extractPlistValue(content, 'Month') ?? '*';
    const weekday = extractPlistValue(content, 'Weekday') ?? '*';

    return `${minute} ${hour} ${day} ${month} ${weekday}`;
  } catch {
    return '* * * * *';
  }
}

/**
 * plist XML에서 특정 키의 integer 값을 추출합니다.
 */
function extractPlistValue(content: string, key: string): string | null {
  const regex = new RegExp(`<key>${key}</key>\\s*<integer>(\\d+)</integer>`);
  const match = content.match(regex);
  return match?.[1] ?? null;
}

/**
 * launchd 사용 가능 여부를 확인합니다. (macOS 전용)
 */
export function isLaunchdAvailable(): boolean {
  return isCommandAvailable('launchctl');
}
