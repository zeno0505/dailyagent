import { spawnSync, type SpawnSyncReturns } from 'child_process';
import { isCommandAvailable, resolveDailyagentCommand } from '../utils/process.js';

const CRONTAB_MARKER = '# dailyagent:';

function runCrontab(args: string[], input?: string): SpawnSyncReturns<string> {
  return spawnSync('crontab', args, {
    encoding: 'utf8',
    input,
    stdio: input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe']
  });
}

/**
 * 현재 사용자의 crontab 항목을 읽어옵니다.
 */
function readCrontab(): string[] {
  const result = runCrontab(['-l']);
  if (result.error || result.status !== 0) {
    // crontab이 비어있거나 아직 생성되지 않으면 실패할 수 있음
    return [];
  }

  return result.stdout.split('\n');
}

function buildCrontabError(action: string, result: SpawnSyncReturns<string>): Error {
  if (result.error) {
    return new Error(`crontab ${action} 실행 실패: ${result.error.message}`);
  }

  const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.status ?? 'unknown'}`;
  return new Error(`crontab ${action} 실패: ${detail}`);
}

/**
 * crontab 항목을 설정합니다.
 */
function writeCrontab(lines: string[]): void {
  const content = lines.filter((l) => l !== '').join('\n') + '\n';
  const result = runCrontab(['-'], content);
  if (result.error || result.status !== 0) {
    throw buildCrontabError('업데이트', result);
  }
}

/**
 * 특정 job의 crontab 마커를 생성합니다.
 */
function marker(jobName: string): string {
  return `${CRONTAB_MARKER}${jobName}`;
}

/**
 * crontab에 job 스케줄을 등록합니다.
 */
export function installCronJob(jobName: string, schedule: string): void {
  const lines = readCrontab();

  // 기존 항목 제거
  const filtered = lines.filter((l) => !l.includes(marker(jobName)));

  const cmd = resolveDailyagentCommand();
  const logDir = `$HOME/.dailyagent/logs`;
  
  const shell = process.env.SHELL || '/bin/bash';
  // cron 환경의 제한된 PATH를 우회: 등록 시점의 PATH를 명시적으로 주입
  // zsh -l 단독으로는 ~/.zshrc가 소싱되지 않아 ~/.local/bin 등이 누락됨
  const envPath = process.env.PATH || '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';
  const cronLine = `${schedule} ${shell} -l -c "export PATH=${envPath}; ${cmd} run ${jobName}" >> ${logDir}/${jobName}-cron.log 2>&1 ${marker(jobName)}`;

  filtered.push(cronLine);
  writeCrontab(filtered);
}

/**
 * crontab에서 job 스케줄을 제거합니다.
 */
export function uninstallCronJob(jobName: string): void {
  const lines = readCrontab();
  const filtered = lines.filter((l) => !l.includes(marker(jobName)));

  if (filtered.length === lines.length) {
    throw new Error(`작업 "${jobName}"의 crontab 항목을 찾을 수 없습니다.`);
  }

  writeCrontab(filtered);
}

/**
 * 특정 job의 crontab 등록 여부를 확인합니다.
 */
export function isCronJobInstalled(jobName: string): boolean {
  const lines = readCrontab();
  return lines.some((l) => l.includes(marker(jobName)));
}

/**
 * 등록된 모든 dailyagent crontab 항목을 조회합니다.
 */
export function listCronJobs(): Array<{ jobName: string; schedule: string; line: string }> {
  const lines = readCrontab();
  const results: Array<{ jobName: string; schedule: string; line: string }> = [];

  for (const line of lines) {
    if (!line.includes(CRONTAB_MARKER)) continue;

    const markerMatch = line.match(new RegExp(`${CRONTAB_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.+)$`));
    if (!markerMatch?.[1]) continue;

    const jobName = markerMatch[1].trim();
    // cron 스케줄은 앞 5개 필드
    const parts = line.trim().split(/\s+/);
    const schedule = parts.slice(0, 5).join(' ');

    results.push({ jobName, schedule, line: line.trim() });
  }

  return results;
}

/**
 * crontab 사용 가능 여부를 확인합니다.
 */
export function isCrontabAvailable(): boolean {
  return isCommandAvailable('crontab');
}
