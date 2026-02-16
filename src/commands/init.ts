import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';
import {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  ensureConfigDir,
  saveConfig,
  isInitialized,
} from '../config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initCommand(): Promise<void> {
  console.log(chalk.bold('\n  DailyAgent 설정 초기화\n'));

  if (isInitialized()) {
    const { overwrite } = await inquirer.prompt<{ overwrite: boolean }>([
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
      type: 'confirm',
      name: 'use_api',
      message: 'Notion API를 직접 사용하시겠습니까? (MCP 대신 API 사용 시 토큰 소비 감소)',
      default: false,
    },
    {
      type: 'input',
      name: 'database_url',
      message: 'Notion 데이터베이스 URL:',
      when: (answers) => !answers.use_api,
      validate: (val: string) => (val.includes('notion.so') ? true : 'Notion URL을 입력해주세요.'),
    },
    {
      type: 'password',
      name: 'api_token',
      message: 'Notion API 토큰 (Internal Integration Token):',
      when: (answers) => answers.use_api,
      validate: (val: string) => (val.length > 0 ? true : 'API 토큰을 입력해주세요.'),
    },
    {
      type: 'input',
      name: 'datasource_id',
      message: 'Notion 데이터소스 ID (API 사용 시 필요):',
      when: (answers) => answers.use_api,
      validate: (val: string) => (val.length > 0 ? true : '데이터소스 ID를 입력해주세요.'),
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
      message: '자동화 준비 완료 상태 값:',
      default: DEFAULT_CONFIG.notion.column_status_wait,
    },
    {
      type: 'input',
      name: 'column_status_review',
      message: '자동화 완료 상태 값:',
      default: DEFAULT_CONFIG.notion.column_status_review,
    },
    {
      type: 'input',
      name: 'column_status_error',
      message: '자동화 오류 상태값:',
      default: DEFAULT_CONFIG.notion.column_status_error,
    },
    {
      type: 'input',
      name: 'column_status_complete',
      message: '작업 완료 상태 값:',
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
      name: 'column_prerequisite',
      message: '선행 작업 컬럼명:',
      default: DEFAULT_CONFIG.notion.column_prerequisite,
    },
    {
      type: 'input',
      name: 'column_created_time',
      message: '작업 일자 컬럼명:',
      default: DEFAULT_CONFIG.notion.column_created_time,
    },
    {
      type: 'confirm',
      name: 'enable_slack',
      message: '(선택사항) Slack 알림을 활성화하시겠습니까?',
      default: false,
    },
    {
      type: 'input',
      name: 'slack_webhook_url',
      message: 'Slack Webhook URL:',
      default: '',
      when: (answers: Record<string, unknown>) => answers.enable_slack === true,
      validate: (val: string) => {
        return val.startsWith('https://hooks.slack.com/services') ? true : 'Slack Webhook URL을 입력해주세요.';
      },
    },
  ]);

  const config = {
    version: DEFAULT_CONFIG.version,
    notion: {
      database_url: answers.database_url,
      use_api: answers.use_api,
      api_token: answers.api_token || undefined,
      datasource_id: answers.datasource_id,
      column_priority: answers.column_priority,
      column_status: answers.column_status,
      column_status_wait: answers.column_status_wait,
      column_status_review: answers.column_status_review,
      column_status_error: answers.column_status_error,
      column_base_branch: answers.column_base_branch,
      column_work_branch: answers.column_work_branch,
      column_prerequisite: answers.column_prerequisite,
      column_created_time: answers.column_created_time,
    },
    slack: {
      enabled: answers.enable_slack as boolean,
      webhook_url: answers.slack_webhook_url as string,
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
