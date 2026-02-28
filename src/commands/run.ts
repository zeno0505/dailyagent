import chalk from 'chalk';
import ora from 'ora';
import { executeJob } from '../core/executor.js';
import { requireConfig, requireJob } from '../utils/validation.js';
import { getWorkspace } from '../workspace.js';

export async function runCommand(name: string): Promise<void> {
  const config = await requireConfig();

  const job = await requireJob(name);
  
  const workspace = await getWorkspace(job.workspace || config.active_workspace || 'default');
  if (!workspace) {
    console.log(chalk.red(`\n  Workspace "${job.workspace}"을(를) 찾을 수 없습니다.`));
    process.exit(1);
  }

  console.log(chalk.bold(`\n  작업 실행: ${name}\n`));
  console.log(chalk.gray(`  작업 디렉토리: ${workspace.working_dir}`));
  console.log(chalk.gray(`  에이전트: ${job.agent}`));
  console.log(chalk.gray(`  프롬프트: ${job.prompt_mode === 'custom' ? '커스텀' : '기본'}`));
  console.log(chalk.gray(`  타임아웃: ${job.timeout}`));
  console.log('');

  const spinner = ora({
    text: `${job.agent} 실행 중...`,
    color: 'cyan',
  }).start();

  try {
    const result = await executeJob(name);

    spinner.succeed('작업이 완료되었습니다!');
    console.log('');

    if (result && typeof result === 'object' && 'rawOutput' in result) {
      console.log(chalk.gray('  결과:'));
      console.log(chalk.gray('  ' + '-'.repeat(60)));
      // Show last portion of raw output
      const lines = String(result.rawOutput).split('\n').slice(-20);
      lines.forEach((line) => console.log(chalk.gray('  ' + line)));
      console.log(chalk.gray('  ' + '-'.repeat(60)));
    } else if (result) {
      console.log(chalk.gray('  결과:'));
      console.log(chalk.gray('  ' + JSON.stringify(result, null, 2).split('\n').join('\n  ')));
    }

    console.log('');
  } catch (err) {
    const error = err as Error;
    spinner.fail(`작업 실패: ${error.message}`);
    process.exit(1);
  }
}
