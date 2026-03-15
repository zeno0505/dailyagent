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
} from '../config.js';
import type { DailyAgentConfig, Workspace } from '../types/config.js';
import { promptWorkDirecotry, promptWorkspaceNotionConfig } from '../utils/workspace.js';

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

  const working_dir = await promptWorkDirecotry();
  const notionConfig = await promptWorkspaceNotionConfig();
  const enable_slack = await confirm({
    message: '(선택사항) Slack 알림을 활성화하시겠습니까?',
    default: false,
  });

  let slack_bot_token = '';
  let slack_target_email = '';
  if (enable_slack) {
    console.log('');
    console.log(chalk.bold('  Slack Bot 설정 안내'));
    console.log(chalk.gray('  api.slack.com/apps 에서 Bot Token을 생성하고 다음 권한을 추가하세요:'));
    console.log(chalk.cyan('    • chat:write') + chalk.gray('        — DM 메시지 발송'));
    console.log(chalk.cyan('    • im:write') + chalk.gray('          — DM 채널 열기'));
    console.log(chalk.cyan('    • users:read.email') + chalk.gray('  — 이메일로 사용자 ID 조회'));
    console.log('');
    slack_bot_token = await input({
      message: 'Slack Bot 토큰 (xoxb-...):',
      validate: (val) => {
        return val.startsWith('xoxb-') ? true : 'xoxb- 로 시작하는 Slack Bot 토큰을 입력해주세요.';
      },
    });
    slack_target_email = await input({
      message: 'Slack DM 수신자 이메일:',
      validate: (val) => {
        return val.includes('@') ? true : '올바른 이메일 주소를 입력해주세요.';
      },
    });
  }

  const defaultWorkspace: Workspace = {
    name: 'default',
    working_dir,
    notion: notionConfig,
  };

  const config: DailyAgentConfig = {
    version: DEFAULT_CONFIG.version,
    workspaces: [defaultWorkspace],
    active_workspace: 'default',
    slack: enable_slack
      ? { enabled: true, bot_token: slack_bot_token, target_email: slack_target_email }
      : { enabled: false },
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
