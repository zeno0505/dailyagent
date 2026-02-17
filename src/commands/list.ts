import chalk from 'chalk';
import Table from 'cli-table3';
import { isInitialized } from '../config';
import { listJobs } from '../jobs';

export async function listCommand(): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const jobs = await listJobs();

  if (jobs.length === 0) {
    console.log(chalk.yellow('\n  등록된 작업이 없습니다.'));
    console.log(`  ${chalk.cyan('dailyagent register')} 명령으로 작업을 등록하세요.\n`);
    return;
  }

  console.log(chalk.bold('\n  등록된 작업 목록\n'));

  const table = new Table({
    head: ['이름', '에이전트', '작업 디렉토리', '스케줄', '상태', '마지막 실행'],
    style: { head: ['gray'] },
  });

  for (const job of jobs) {
    const statusColor = job.status === 'paused'
      ? chalk.yellow
      : job.last_status === 'success'
        ? chalk.green
        : job.last_status === 'error'
          ? chalk.red
          : chalk.gray;

    const lastRun = job.last_run
      ? new Date(job.last_run).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      : '-';

    const dirW = 30;
    const dir = job.working_dir.length > dirW
      ? '...' + job.working_dir.slice(-(dirW - 3))
      : job.working_dir;

    table.push([
      chalk.bold(job.name),
      job.agent,
      dir,
      job.schedule,
      statusColor(job.status === 'paused' ? 'paused' : (job.last_status || '-')),
      lastRun,
    ]);
  }

  console.log(table.toString());
  console.log('');
}
