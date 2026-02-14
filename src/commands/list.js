'use strict';

const chalk = require('chalk');
const { isInitialized } = require('../config');
const { listJobs } = require('../jobs');

async function listCommand() {
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

  // Table header
  const nameW = 20;
  const agentW = 12;
  const dirW = 30;
  const schedW = 16;
  const statusW = 10;
  const lastRunW = 20;

  const header = [
    '이름'.padEnd(nameW),
    '에이전트'.padEnd(agentW),
    '작업 디렉토리'.padEnd(dirW),
    '스케줄'.padEnd(schedW),
    '상태'.padEnd(statusW),
    '마지막 실행'.padEnd(lastRunW),
  ].join('  ');

  console.log(chalk.gray('  ' + header));
  console.log(chalk.gray('  ' + '-'.repeat(header.length)));

  for (const job of jobs) {
    const statusColor = job.last_status === 'success'
      ? chalk.green
      : job.last_status === 'error'
        ? chalk.red
        : chalk.gray;

    const lastRun = job.last_run
      ? new Date(job.last_run).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
      : '-';

    const row = [
      chalk.bold(job.name.padEnd(nameW)),
      job.agent.padEnd(agentW),
      (job.working_dir.length > dirW ? '...' + job.working_dir.slice(-(dirW - 3)) : job.working_dir).padEnd(dirW),
      job.schedule.padEnd(schedW),
      statusColor((job.last_status || '-').padEnd(statusW)),
      lastRun.padEnd(lastRunW),
    ].join('  ');

    console.log('  ' + row);
  }

  console.log('');
}

module.exports = { listCommand };
