import { input } from '@inquirer/prompts';
import chalk from 'chalk';
import { isInitialized } from '../../config.js';
import { addWorkspace } from '../../workspace.js';
import type { Workspace } from '../../types/config.js';
import { promptWorkDirecotry, promptWorkspaceNotionConfig } from '../../utils/workspace.js';

export async function workspaceAddCommand(): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  console.log(chalk.bold('\n  새 Workspace 추가\n'));

  const name = await input({
    message: 'Workspace 이름 (영문, 하이픈 허용):',
    validate: (val) => {
      if (!val) return 'Workspace 이름을 입력해주세요.';
      if (!/^[a-z0-9-]+$/.test(val)) return '영문 소문자, 숫자, 하이픈만 사용 가능합니다.';
      return true;
    },
  });

  const working_dir = await promptWorkDirecotry();
  const notionConfig = await promptWorkspaceNotionConfig();
  const workspace: Workspace = {
    name,
    working_dir,
    notion: notionConfig,
  };

  try {
    await addWorkspace(workspace);

    console.log('');
    console.log(chalk.green(`  Workspace "${name}"이(가) 추가되었습니다!`));
    console.log(`  ${chalk.cyan(`dailyagent workspace switch ${name}`)} 명령으로 기본 Workspace로 설정할 수 있습니다.`);
    console.log('');
  } catch (err) {
    const error = err as Error;
    console.log(chalk.red(`\n  오류: ${error.message}\n`));
    process.exit(1);
  }
}
