import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import os from 'os';
import { readdirSync } from 'fs-extra';

const PLIST_PREFIX = 'com.dailyagent.job.';
const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents');

/**
 * cron 스케줄(5필드)을 launchd plist의 StartCalendarInterval로 변환합니다.
 * 지원: 고정 숫자값 (*, 리스트, 범위 등은 단순화하여 처리)
 */
function cronToCalendarInterval(schedule: string): Record<string, number>[] {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`잘못된 cron 스케줄 형식: "${schedule}" (5개 필드 필요)`);
  }

  const [minute, hour, day, month, weekday] = parts.map((part) => {
    if (part === '*') return null;
    if (/\D+/.test(part)) return null;
    let parsed = parseInt(part, 10);
    if (isNaN(parsed)) return null;
    return parsed;
  });

  const interval: Record<string, number> = {};

  if (minute) {
    interval.Minute = minute;
  }
  if (hour) {
    interval.Hour = hour;
  }
  if (day) {
    interval.Day = day;
  }
  if (month) {
    interval.Month = month;
  }
  if (weekday) {
    interval.Weekday = weekday;
  }

  return [interval];
}

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

/**
 * dailyagent 실행 명령을 찾습니다.
 */
function resolveDailyagentCommand(): string {
  try {
    const which = execSync('which dailyagent 2>/dev/null', { encoding: 'utf8' }).trim();
    if (which) return which;
  } catch {
    // ignore
  }

  try {
    const npxPath = execSync('which npx 2>/dev/null', { encoding: 'utf8' }).trim();
    if (npxPath) return `${npxPath} dailyagent`;
  } catch {
    // ignore
  }

  return 'dailyagent';
}

/**
 * plist XML 내용을 생성합니다.
 */
function generatePlist(jobName: string, schedule: string): string {
  const label = plistLabel(jobName);
  const cmd = resolveDailyagentCommand();
  const logDir = path.join(os.homedir(), '.dailyagent', 'logs');
  const intervals = cronToCalendarInterval(schedule);

  // 명령어를 공백으로 분리하여 ProgramArguments 배열 생성
  const cmdParts = cmd.split(/\s+/);
  const programArgs = [...cmdParts, 'run', jobName];

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
    <key>StandardOutPath</key>
    <string>${escapeXml(path.join(logDir, `${jobName}-launchd.log`))}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(path.join(logDir, `${jobName}-launchd.log`))}</string>
    <key>RunAtLoad</key>
    <false/>
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
    try {
      execSync(`launchctl unload "${filePath}" 2>/dev/null`, { encoding: 'utf8' });
    } catch {
      // 이미 unload 상태일 수 있음
    }
  }

  // plist 파일 생성
  const plistContent = generatePlist(jobName, schedule);
  writeFileSync(filePath, plistContent, 'utf8');

  // launchctl에 등록
  try {
    execSync(`launchctl load "${filePath}"`, { encoding: 'utf8' });
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

  try {
    execSync(`launchctl unload "${filePath}" 2>/dev/null`, { encoding: 'utf8' });
  } catch {
    // 이미 unload 상태일 수 있음
  }

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
 * plist 파일에서 StartCalendarInterval을 읽어 cron 스케줄 형태로 변환합니다.
 */
function extractScheduleFromPlist(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf8');

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
  try {
    execSync('which launchctl 2>/dev/null', { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}
