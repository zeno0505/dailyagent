import chalk from 'chalk';
import { isInitialized } from '../../config.js';
import { listWorkspaces, getActiveWorkspace } from '../../workspace.js';

export async function workspaceListCommand(): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const workspaces = await listWorkspaces();
  const active = await getActiveWorkspace();

  if (workspaces.length === 0) {
    console.log(chalk.yellow('\n  등록된 Workspace가 없습니다.\n'));
    return;
  }

  console.log(chalk.bold('\n  등록된 Workspaces\n'));

  workspaces.forEach(ws => {
    const isActive = ws.name === active?.name;
    const indicator = isActive ? chalk.green('●') : ' ';
    const name = isActive ? chalk.cyan(ws.name) : ws.name;
    const dbInfo = ws.notion?.api_token ? '(Notion API)' : '(미설정)';

    console.log(`  ${indicator} ${name} ${chalk.gray(dbInfo)}`);
  });

  console.log('');
}
