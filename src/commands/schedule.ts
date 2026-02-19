import chalk from 'chalk';
import Table from 'cli-table3';
import os from 'os';
import { isInitialized } from '../config.js';
import { getJob, listJobs } from '../jobs.js';
import {
  listCronJobs,
} from '../scheduler/crontab.js';
import {
  listLaunchdJobs,
} from '../scheduler/launchd.js';
import { detectScheduler, installJob, isJobInstalled, schedulerName, SchedulerType, uninstallJob } from '../utils/schedule.js';



export async function scheduleCommand(action: string, name?: string): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const scheduler = detectScheduler();

  if (!scheduler) {
    console.log(chalk.red('\n  사용 가능한 스케줄러가 없습니다.'));
    console.log(chalk.gray('  macOS: launchd (기본 제공)'));
    console.log(chalk.gray('  Linux: cron 서비스가 설치되어 있는지 확인하세요.\n'));
    process.exit(1);
  }

  console.log(chalk.gray(`  스케줄러: ${schedulerName(scheduler)} (${os.platform()})`));

  switch (action) {
    case 'on':
      await scheduleOn(name, scheduler);
      break;
    case 'off':
      await scheduleOff(name, scheduler);
      break;
    case 'status':
      await scheduleStatus(scheduler);
      break;
    default:
      console.log(chalk.red(`\n  알 수 없는 동작: ${action}`));
      console.log(chalk.gray('  사용법: dailyagent schedule <on|off|status> [job-name]\n'));
      process.exit(1);
  }
}


async function scheduleOn(name: string | undefined, scheduler: SchedulerType): Promise<void> {
  if (!name) {
    console.log(chalk.red('\n  작업 이름을 지정해주세요.'));
    console.log(chalk.gray('  사용법: dailyagent schedule on <job-name>\n'));
    process.exit(1);
  }

  const job = await getJob(name);
  if (!job) {
    console.log(chalk.red(`\n  작업 "${name}"을(를) 찾을 수 없습니다.`));
    console.log(`  ${chalk.cyan('dailyagent list')} 명령으로 작업 목록을 확인하세요.\n`);
    process.exit(1);
  }

  if (isJobInstalled(name)) {
    console.log(chalk.yellow(`\n  작업 "${name}"은(는) 이미 스케줄이 등록되어 있습니다.`));
    console.log(chalk.gray(`  해제 후 재등록하려면: dailyagent schedule off ${name}\n`));
    return;
  }

  try {
    installJob(name, job.schedule);
    console.log(chalk.green(`\n  작업 "${name}" 스케줄이 등록되었습니다. (${schedulerName(scheduler)})`));
    console.log(chalk.gray(`  스케줄: ${job.schedule}`));
    console.log(chalk.gray(`  확인: dailyagent schedule status\n`));
  } catch (err) {
    const error = err as Error;
    console.log(chalk.red(`\n  스케줄 등록 실패: ${error.message}\n`));
    process.exit(1);
  }
}

async function scheduleOff(name: string | undefined, scheduler: SchedulerType): Promise<void> {
  if (!name) {
    console.log(chalk.red('\n  작업 이름을 지정해주세요.'));
    console.log(chalk.gray('  사용법: dailyagent schedule off <job-name>\n'));
    process.exit(1);
  }

  const job = await getJob(name);
  if (!job) {
    console.log(chalk.red(`\n  작업 "${name}"을(를) 찾을 수 없습니다.\n`));
    process.exit(1);
  }

  try {
    uninstallJob(name);
    console.log(chalk.green(`\n  작업 "${name}" 스케줄이 해제되었습니다. (${schedulerName(scheduler)})\n`));
  } catch (err) {
    const error = err as Error;
    console.log(chalk.yellow(`\n  ${error.message}\n`));
  }
}

async function scheduleStatus(scheduler: SchedulerType): Promise<void> {
  const jobs = await listJobs();

  console.log(chalk.bold('\n  스케줄러 상태\n'));

  if (jobs.length === 0) {
    console.log(chalk.gray('  등록된 작업이 없습니다.\n'));
    return;
  }

  const headerScheduler = schedulerName(scheduler);

  const table = new Table({
    head: ['작업명', '스케줄', headerScheduler],
    style: { head: ['cyan'] },
  });

  const schedules = scheduler === 'launchd' ? listLaunchdJobs() : listCronJobs();
  for (const job of jobs) {
    const entry = schedules.find((s) => s.jobName === job.name);
    const status = entry ? chalk.green('등록됨') : chalk.gray('미등록');
    const schedule = entry ? entry.schedule : job.schedule;
    table.push([job.name, schedule, status]);
  }

  console.log(table.toString());
  console.log('');
}
