import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { isInitialized } from '../../config.js';
import { listWorkspaces, switchWorkspace } from '../../workspace.js';

export async function workspaceSwitchCommand(name?: string): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const workspaces = await listWorkspaces();

  if (workspaces.length === 0) {
    console.log(chalk.yellow('\n  등록된 Workspace가 없습니다.\n'));
    return;
  }

  let workspaceName = name;

  if (!workspaceName) {
    console.log(chalk.bold('\n  Workspace 선택\n'));

    workspaceName = await select({
      message: '활성화할 Workspace:',
      choices: workspaces.map(ws => ({
        name: ws.name,
        value: ws.name,
      })),
    });
  }

  try {
    await switchWorkspace(workspaceName);

    console.log('');
    console.log(chalk.green(`  Workspace "${workspaceName}"이(가) 활성화되었습니다!`));
    console.log('');
  } catch (err) {
    const error = err as Error;
    console.log(chalk.red(`\n  오류: ${error.message}\n`));
    process.exit(1);
  }
}
