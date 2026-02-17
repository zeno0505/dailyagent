import { execSync } from 'child_process';

const CRONTAB_MARKER = '# dailyagent:';

/**
 * 현재 사용자의 crontab 항목을 읽어옵니다.
 */
function readCrontab(): string[] {
  try {
    const output = execSync('crontab -l 2>/dev/null', { encoding: 'utf8' });
    return output.split('\n');
  } catch {
    // crontab이 비어있으면 에러 발생
    return [];
  }
}

/**
 * crontab 항목을 설정합니다.
 */
function writeCrontab(lines: string[]): void {
  const content = lines.filter((l) => l !== '').join('\n') + '\n';
  execSync('crontab -', { input: content, encoding: 'utf8' });  
}

/**
 * dailyagent 실행 명령을 찾습니다. (npx 또는 글로벌 설치)
 */
function resolveDailyagentCommand(): string {
  try {
    const which = execSync('which dailyagent 2>/dev/null', { encoding: 'utf8' }).trim();
    if (which) return which;
  } catch {
    // ignore
  }

  // npx 사용 fallback
  try {
    const npxPath = execSync('which npx 2>/dev/null', { encoding: 'utf8' }).trim();
    if (npxPath) return `${npxPath} dailyagent`;
  } catch {
    // ignore
  }

  return 'dailyagent';
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
  const cronLine = `${schedule} ${cmd} run ${jobName} >> ${logDir}/${jobName}-cron.log 2>&1 ${marker(jobName)}`;

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
  try {
    execSync('which crontab 2>/dev/null', { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}
