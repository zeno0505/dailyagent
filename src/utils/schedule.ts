import os from 'os';
import { installLaunchdJob, isLaunchdAvailable, isLaunchdJobInstalled, uninstallLaunchdJob } from "../scheduler/launchd.js";
import { installCronJob, isCronJobInstalled, isCrontabAvailable, uninstallCronJob } from '../scheduler/crontab.js';

export type SchedulerType = 'launchd' | 'cron';

/**
 * 스케줄러 이름을 반환합니다.
 */
export function schedulerName(type: SchedulerType): string {
  return type === 'launchd' ? 'launchd' : 'crontab';
}

/**
 * 현재 OS 환경에 따라 사용할 스케줄러를 결정합니다.
 * macOS: launchd 우선, fallback으로 cron
 * Linux/기타: cron
 */
export function detectScheduler(): SchedulerType | null {
  const platform = os.platform();

  if (platform === 'darwin') {
    if (isLaunchdAvailable()) return 'launchd';
    if (isCrontabAvailable()) return 'cron';
    return null;
  }

  // Linux 및 기타 OS
  if (isCrontabAvailable()) return 'cron';
  return null;
}

export function isJobInstalled(jobName: string): boolean {
  const scheduler = detectScheduler();
  if (!scheduler) {
    return false;
  }
  return scheduler === 'launchd'
    ? isLaunchdJobInstalled(jobName)
    : isCronJobInstalled(jobName);
}

export function installJob(jobName: string, schedule: string): void {
  const scheduler = detectScheduler();
  if (scheduler === 'launchd') {
    installLaunchdJob(jobName, schedule);
  } else if (scheduler === 'cron') {
    installCronJob(jobName, schedule);
  }
}

export function uninstallJob(jobName: string): void {
  const scheduler = detectScheduler();
  if (scheduler === 'launchd') {
    uninstallLaunchdJob(jobName);
  } else if (scheduler === 'cron') {
    uninstallCronJob(jobName);
  }
}


/**
 * cron 필드 값을 숫자 배열로 전개합니다.
 * - `*`       → null (와일드카드, 제약 없음)
 * - `*\/N`    → [min, min+N, min+2N, ...] (스텝 전개)
 * - `a,b,c`   → [a, b, c] (리스트)
 * - `a-b`     → [a, a+1, ..., b] (범위)
 * - `N`       → [N] (단일 값)
 */
export function expandCronField(part: string, rangeMin: number, rangeMax: number): number[] | null {
  if (part === '*') return null;

  // */N 스텝 표현식
  const stepMatch = part.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = parseInt(stepMatch[1]!, 10);
    if (step <= 0) return null;
    const values: number[] = [];
    for (let i = rangeMin; i <= rangeMax; i += step) {
      values.push(i);
    }
    return values;
  }

  // 콤마 리스트 (a,b,c)
  if (part.includes(',')) {
    return part
      .split(',')
      .map((v) => parseInt(v.trim(), 10))
      .filter((v) => !isNaN(v));
  }

  // 범위 (a-b)
  const rangeMatch = part.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1]!, 10);
    const end = parseInt(rangeMatch[2]!, 10);
    const values: number[] = [];
    for (let i = start; i <= end; i++) {
      values.push(i);
    }
    return values;
  }

  // 단일 숫자
  const num = parseInt(part, 10);
  if (!isNaN(num)) return [num];

  return null;
}

/**
 * cron 스케줄(5필드)을 launchd plist의 StartCalendarInterval로 변환합니다.
 * `*\/N` 스텝 표현식은 해당하는 여러 개의 interval 엔트리로 전개됩니다.
 */
export function cronToCalendarInterval(schedule: string): Record<string, number>[] {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`잘못된 cron 스케줄 형식: "${schedule}" (5개 필드 필요)`);
  }

  const fieldDefs: Array<{ key: string; part: string; rangeMin: number; rangeMax: number }> = [
    { key: 'Minute', part: parts[0]!, rangeMin: 0, rangeMax: 59 },
    { key: 'Hour', part: parts[1]!, rangeMin: 0, rangeMax: 23 },
    { key: 'Day', part: parts[2]!, rangeMin: 1, rangeMax: 31 },
    { key: 'Month', part: parts[3]!, rangeMin: 1, rangeMax: 12 },
    { key: 'Weekday', part: parts[4]!, rangeMin: 0, rangeMax: 6 },
  ];

  // 크로스 곱 방식으로 intervals 생성
  // 와일드카드 필드는 dict에 포함하지 않음 (launchd 의미와 동일)
  let intervals: Record<string, number>[] = [{}];

  for (const { key, part, rangeMin, rangeMax } of fieldDefs) {
    const values = expandCronField(part, rangeMin, rangeMax);
    if (values === null) continue; // 와일드카드는 건너뜀

    const expanded: Record<string, number>[] = [];
    for (const interval of intervals) {
      for (const val of values) {
        expanded.push({ ...interval, [key]: val });
      }
    }
    intervals = expanded;
  }

  return intervals;
}