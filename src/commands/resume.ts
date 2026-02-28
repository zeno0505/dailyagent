import chalk from 'chalk';
import { updateJob } from '../jobs.js';
import { requireInitialized, requireJob } from '../utils/validation.js';

export async function resumeCommand(name: string): Promise<void> {
  requireInitialized();

  const job = await requireJob(name);

  if (job.status === 'active') {
    console.log(chalk.yellow(`\n  작업 "${name}"은(는) 이미 활성 상태입니다.\n`));
    return;
  }

  await updateJob(name, { status: 'active' });
  console.log(chalk.green(`\n  작업 "${name}"이(가) 재개되었습니다.\n`));
}
