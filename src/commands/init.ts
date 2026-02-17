import { input, confirm } from '@inquirer/prompts';
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
import type { DailyAgentConfig, Workspace } from '../types/config';
import { promptWorkspaceNotionConfig } from '../utils/workspace';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initCommand(): Promise<void> {
  console.log(chalk.bold('\n  DailyAgent 설정 초기화\n'));

  if (isInitialized()) {
    const overwrite = await confirm({
      message: '설정이 이미 존재합니다. 덮어쓰시겠습니까?',
      default: false,
    });
    if (!overwrite) {
      console.log(chalk.yellow('초기화를 취소했습니다.'));
      return;
    }
  }

  const notionConfig = await promptWorkspaceNotionConfig();
  const enable_slack = await confirm({
    message: '(선택사항) Slack 알림을 활성화하시겠습니까?',
    default: false,
  });

  let slack_webhook_url = '';
  if (enable_slack) {
    slack_webhook_url = await input({
      message: 'Slack Webhook URL:',
      validate: (val) => {
        return val.startsWith('https://hooks.slack.com/services') ? true : 'Slack Webhook URL을 입력해주세요.';
      },
    });
  }

  const defaultWorkspace: Workspace = {
    name: 'default',
    notion: notionConfig,
  };

  const config: DailyAgentConfig = {
    version: DEFAULT_CONFIG.version,
    workspaces: [defaultWorkspace],
    active_workspace: 'default',
    slack: {
      enabled: enable_slack,
      webhook_url: slack_webhook_url,
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
