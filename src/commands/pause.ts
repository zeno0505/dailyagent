import chalk from 'chalk';
import { updateJob } from '../jobs.js';
import { requireInitialized, requireJob } from '../utils/validation.js';

export async function pauseCommand(name: string): Promise<void> {
  requireInitialized();

  const job = await requireJob(name);

  if (job.status === 'paused') {
    console.log(chalk.yellow(`\n  작업 "${name}"은(는) 이미 일시 중지 상태입니다.\n`));
    return;
  }

  await updateJob(name, { status: 'paused' });
  console.log(chalk.green(`\n  작업 "${name}"이(가) 일시 중지되었습니다.`));
  console.log(`  ${chalk.cyan('dailyagent resume ' + name)} 명령으로 재개할 수 있습니다.\n`);
}
