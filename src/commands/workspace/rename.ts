import chalk from "chalk";
import { isInitialized } from "../../config.js";
import { renameWorkspace } from "../../workspace.js";

export async function workspaceRenameCommand(oldName: string, newName: string): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  try {
    await renameWorkspace(oldName, newName);
    console.log('');
    console.log(chalk.green(`  Workspace "${oldName}"이(가) "${newName}"으로 변경되었습니다!`));
    console.log('');
  } catch (err) {
    const error = err as Error;
    console.log(chalk.red(`\n  오류: ${error.message}\n`));
    process.exit(1);
  }
}