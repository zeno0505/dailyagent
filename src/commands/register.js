'use strict';

const inquirer = require('inquirer');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const { isInitialized, loadConfig } = require('../config');
const { addJob } = require('../jobs');

async function registerCommand() {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const config = await loadConfig();

  console.log(chalk.bold('\n  새 작업 등록\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: '작업 이름 (영문, 하이픈 허용):',
      validate: (val) => {
        if (!val) return '작업 이름을 입력해주세요.';
        if (!/^[a-z0-9-]+$/.test(val)) return '영문 소문자, 숫자, 하이픈만 사용 가능합니다.';
        return true;
      },
    },
    {
      type: 'list',
      name: 'agent',
      message: 'AI 에이전트:',
      choices: ['claude-code'],
      default: config.defaults.agent,
    },
    {
      type: 'input',
      name: 'working_dir',
      message: '작업 디렉토리 (절대경로 또는 ~/ 사용):',
      validate: (val) => {
        if (!val) return '작업 디렉토리를 입력해주세요.';
        const resolved = val.replace(/^~/, process.env.HOME);
        if (!fs.pathExistsSync(resolved)) return `디렉토리가 존재하지 않습니다: ${resolved}`;
        if (!fs.pathExistsSync(path.join(resolved, '.git'))) return `Git 저장소가 아닙니다: ${resolved}`;
        return true;
      },
    },
    {
      type: 'input',
      name: 'schedule',
      message: 'Cron 스케줄 (후속 작업용, 예: 0 */5 * * *):',
      default: '0 */5 * * *',
    },
    {
      type: 'input',
      name: 'timeout',
      message: '타임아웃 (예: 30m, 1h):',
      default: config.defaults.timeout,
    },
    {
      type: 'input',
      name: 'base_branch',
      message: '기본 기준 브랜치:',
      default: config.defaults.base_branch,
    },
  ]);

  try {
    await addJob({
      name: answers.name,
      agent: answers.agent,
      working_dir: answers.working_dir,
      schedule: answers.schedule,
      timeout: answers.timeout,
      base_branch: answers.base_branch,
    });

    console.log('');
    console.log(chalk.green(`  작업 "${answers.name}"이(가) 등록되었습니다!`));
    console.log('');
    console.log(`  실행: ${chalk.cyan(`dailyagent run ${answers.name}`)}`);
    console.log('');
  } catch (err) {
    console.log(chalk.red(`\n  오류: ${err.message}\n`));
    process.exit(1);
  }
}

module.exports = { registerCommand };
