import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import { isInitialized } from '../../config';
import { removeWorkspace, getWorkspace } from '../../workspace';
import { listJobs } from '../../jobs';

export async function workspaceRemoveCommand(name: string): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  if (!name) {
    console.log(chalk.red('\nWorkspace 이름을 입력해주세요. (dailyagent workspace remove <name>)\n'));
    process.exit(1);
  }

  const workspace = await getWorkspace(name);
  if (!workspace) {
    console.log(chalk.red(`\nWorkspace "${name}"을(를) 찾을 수 없습니다.\n`));
    process.exit(1);
  }

  // Check if any jobs belong to this workspace
  const allJobs = await listJobs();
  const workspaceJobs = allJobs.filter(job => job.workspace === name);

  if (workspaceJobs.length > 0) {
    console.log(chalk.yellow(`\n  이 Workspace에 ${workspaceJobs.length}개의 작업이 있습니다:`));
    workspaceJobs.forEach(job => {
      console.log(chalk.gray(`    - ${job.name}`));
    });
    console.log('');
  }

  const confirmed = await confirm({
    message: `Workspace "${name}"을(를) 삭제하시겠습니까?`,
    default: false,
  });

  if (!confirmed) {
    console.log(chalk.yellow('\n  삭제를 취소했습니다.\n'));
    return;
  }

  try {
    await removeWorkspace(name);

    console.log('');
    console.log(chalk.green(`  Workspace "${name}"이(가) 삭제되었습니다!`));
    console.log('');
  } catch (err) {
    const error = err as Error;
    console.log(chalk.red(`\n  오류: ${error.message}\n`));
    process.exit(1);
  }
}
