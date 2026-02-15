'use strict';

const chalk = require('chalk');
const { isInitialized } = require('../config');
const { getJob, updateJob } = require('../jobs');

async function resumeCommand(name) {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const job = await getJob(name);
  if (!job) {
    console.log(chalk.red(`\n  작업 "${name}"을(를) 찾을 수 없습니다.`));
    console.log(`  ${chalk.cyan('dailyagent list')} 명령으로 작업 목록을 확인하세요.\n`);
    process.exit(1);
  }

  if (job.status === 'active') {
    console.log(chalk.yellow(`\n  작업 "${name}"은(는) 이미 활성 상태입니다.\n`));
    return;
  }

  await updateJob(name, { status: 'active' });
  console.log(chalk.green(`\n  작업 "${name}"이(가) 재개되었습니다.\n`));
}

module.exports = { resumeCommand };
