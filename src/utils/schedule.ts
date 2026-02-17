import os from 'os';
import { installLaunchdJob, isLaunchdAvailable, isLaunchdJobInstalled, uninstallLaunchdJob } from "../scheduler/launchd";
import { installCronJob, isCronJobInstalled, isCrontabAvailable, uninstallCronJob } from '../scheduler/crontab';

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
