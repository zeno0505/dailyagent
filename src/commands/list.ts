import chalk from 'chalk';
import Table from 'cli-table3';
import { isInitialized, loadConfig } from '../config';
import { listJobs } from '../jobs';
import { getWorkspace, listWorkspaces } from '../workspace';

export async function listCommand(): Promise<void> {
  const config = await loadConfig();
  if (!config || !isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const jobs = await listJobs();

  if (jobs.length === 0) {
    console.log(chalk.yellow('\n  등록된 작업이 없습니다.'));
    console.log(`  ${chalk.cyan('dailyagent register')} 명령으로 작업을 등록하세요.\n`);
    return;
  }

  const workspaces = await listWorkspaces();
  if (workspaces.length === 0) {
    console.log(chalk.yellow('\n  등록된 Workspace가 없습니다.'));
    console.log(`  ${chalk.cyan('dailyagent workspace add')} 명령으로 Workspace를 등록하세요.\n`);
    return;
  }

  console.log(chalk.bold('\n  등록된 작업 목록\n'));

  const table = new Table({
    head: ['이름', '에이전트', '작업 디렉토리', '스케줄', '상태', '마지막 실행'],
    style: { head: ['gray'] },
  });
  
  const dirW = 30;
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
    const workspace = await getWorkspace(job.workspace || config.active_workspace || 'default');
    if (!workspace) {
      console.log(chalk.red(`\n  Workspace "${job.workspace || config.active_workspace || 'default'}"을(를) 찾을 수 없습니다.`));
      process.exit(1);
    }

    const dir = workspace.working_dir.length > dirW
      ? '...' + workspace.working_dir.slice(-(dirW - 3))
      : workspace.working_dir;

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
