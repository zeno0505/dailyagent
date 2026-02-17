import chalk from 'chalk';
import { isInitialized } from '../config';
import { getJob, listJobs } from '../jobs';
import {
  installCronJob,
  uninstallCronJob,
  isCronJobInstalled,
  listCronJobs,
  isCrontabAvailable,
} from '../scheduler/crontab';

export async function scheduleCommand(action: string, name?: string): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  if (!isCrontabAvailable()) {
    console.log(chalk.red('\n  crontab을 사용할 수 없습니다.'));
    console.log(chalk.gray('  cron 서비스가 설치되어 있는지 확인하세요.\n'));
    process.exit(1);
  }

  switch (action) {
    case 'on':
      await scheduleOn(name);
      break;
    case 'off':
      await scheduleOff(name);
      break;
    case 'status':
      await scheduleStatus();
      break;
    default:
      console.log(chalk.red(`\n  알 수 없는 동작: ${action}`));
      console.log(chalk.gray('  사용법: dailyagent schedule <on|off|status> [job-name]\n'));
      process.exit(1);
  }
}

async function scheduleOn(name?: string): Promise<void> {
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

  if (isCronJobInstalled(name)) {
    console.log(chalk.yellow(`\n  작업 "${name}"은(는) 이미 스케줄이 등록되어 있습니다.`));
    console.log(chalk.gray(`  해제 후 재등록하려면: dailyagent schedule off ${name}\n`));
    return;
  }

  try {
    installCronJob(name, job.schedule);
    console.log(chalk.green(`\n  작업 "${name}" 스케줄이 등록되었습니다.`));
    console.log(chalk.gray(`  스케줄: ${job.schedule}`));
    console.log(chalk.gray(`  확인: dailyagent schedule status\n`));
  } catch (err) {
    const error = err as Error;
    console.log(chalk.red(`\n  스케줄 등록 실패: ${error.message}\n`));
    process.exit(1);
  }
}

async function scheduleOff(name?: string): Promise<void> {
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
    uninstallCronJob(name);
    console.log(chalk.green(`\n  작업 "${name}" 스케줄이 해제되었습니다.\n`));
  } catch (err) {
    const error = err as Error;
    console.log(chalk.yellow(`\n  ${error.message}\n`));
  }
}

async function scheduleStatus(): Promise<void> {
  const cronJobs = listCronJobs();
  const jobs = await listJobs();

  console.log(chalk.bold('\n  스케줄러 상태\n'));

  if (jobs.length === 0) {
    console.log(chalk.gray('  등록된 작업이 없습니다.\n'));
    return;
  }

  console.log(chalk.cyan('  작업명'.padEnd(22) + '스케줄'.padEnd(20) + 'crontab'));
  console.log(chalk.gray('  ' + '-'.repeat(55)));

  for (const job of jobs) {
    const cronEntry = cronJobs.find((c) => c.jobName === job.name);
    const cronStatus = cronEntry ? chalk.green('등록됨') : chalk.gray('미등록');
    const schedule = cronEntry ? cronEntry.schedule : job.schedule;

    console.log(
      `  ${job.name.padEnd(20)} ${schedule.padEnd(24)} ${cronStatus}`
    );
  }

  console.log('');
}
