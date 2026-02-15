'use strict';

const inquirer = require('inquirer');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  ensureConfigDir,
  saveConfig,
  isInitialized,
} = require('../config');

async function initCommand() {
  console.log(chalk.bold('\n  DailyAgent 설정 초기화\n'));

  if (isInitialized()) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: '설정이 이미 존재합니다. 덮어쓰시겠습니까?',
        default: false,
      },
    ]);
    if (!overwrite) {
      console.log(chalk.yellow('초기화를 취소했습니다.'));
      return;
    }
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'database_url',
      message: 'Notion 데이터베이스 URL:',
      validate: (val) => (val.includes('notion.so') ? true : 'Notion URL을 입력해주세요.'),
    },
    {
      type: 'input',
      name: 'column_priority',
      message: '우선순위 컬럼명:',
      default: DEFAULT_CONFIG.notion.column_priority,
    },
    {
      type: 'input',
      name: 'column_status',
      message: '상태 컬럼명:',
      default: DEFAULT_CONFIG.notion.column_status,
    },
    {
      type: 'input',
      name: 'column_status_wait',
      message: '대기 상태값:',
      default: DEFAULT_CONFIG.notion.column_status_wait,
    },
    {
      type: 'input',
      name: 'column_status_complete',
      message: '완료 상태값:',
      default: DEFAULT_CONFIG.notion.column_status_complete,
    },
    {
      type: 'input',
      name: 'column_base_branch',
      message: '기준 브랜치 컬럼명:',
      default: DEFAULT_CONFIG.notion.column_base_branch,
    },
    {
      type: 'input',
      name: 'column_work_branch',
      message: '작업 브랜치 컬럼명:',
      default: DEFAULT_CONFIG.notion.column_work_branch,
    },
    {
      type: 'input',
      name: 'default_timeout',
      message: '기본 타임아웃 (예: 30m, 1h):',
      default: DEFAULT_CONFIG.defaults.timeout,
    },
    {
      type: 'input',
      name: 'default_base_branch',
      message: '기본 기준 브랜치:',
      default: DEFAULT_CONFIG.defaults.base_branch,
    },
  ]);

  const config = {
    version: DEFAULT_CONFIG.version,
    notion: {
      database_url: answers.database_url,
      column_priority: answers.column_priority,
      column_status: answers.column_status,
      column_status_wait: answers.column_status_wait,
      column_status_complete: answers.column_status_complete,
      column_base_branch: answers.column_base_branch,
      column_work_branch: answers.column_work_branch,
    },
    defaults: {
      agent: 'claude-code',
      timeout: answers.default_timeout,
      base_branch: answers.default_base_branch,
    },
  };

  await ensureConfigDir();
  await saveConfig(config);

  // Copy claude-settings.json template
  const templateSrc = path.join(__dirname, '..', '..', 'templates', 'claude-settings.json');
  const templateDst = path.join(CONFIG_DIR, 'claude-settings.json');
  if (await fs.pathExists(templateSrc)) {
    await fs.copy(templateSrc, templateDst);
  }

  console.log('');
  console.log(chalk.green('  설정이 완료되었습니다!'));
  console.log(chalk.gray(`  설정 파일: ${CONFIG_FILE}`));
  console.log(chalk.gray(`  설정 디렉토리: ${CONFIG_DIR}`));
  console.log('');
  console.log(chalk.bold('  다음 단계:'));
  console.log(`  ${chalk.cyan('dailyagent register')}  작업 등록`);
  console.log(`  ${chalk.cyan('dailyagent list')}      작업 목록 조회`);
  console.log(`  ${chalk.cyan('dailyagent run <name>')} 작업 실행`);
  console.log('');
}

module.exports = { initCommand };
