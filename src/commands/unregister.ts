import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { isInitialized, LOGS_DIR, LOCKS_DIR } from '../config';
import { getJob, removeJob } from '../jobs';

export async function unregisterCommand(name: string): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const job = await getJob(name);
  if (!job) {
    console.log(chalk.red(`\n  작업 "${name}"을(를) 찾을 수 없습니다.\n`));
    process.exit(1);
  }

  console.log('');
  console.log(chalk.bold(`  작업 정보`));
  console.log(`  이름: ${chalk.cyan(job.name)}`);
  console.log(`  작업 디렉토리: ${job.working_dir}`);
  console.log(`  스케줄: ${job.schedule}`);
  console.log(`  상태: ${job.status}`);
  console.log('');

  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: 'confirm',
      name: 'confirm',
      message: `작업 "${name}"을(를) 삭제하시겠습니까?`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\n  삭제가 취소되었습니다.\n'));
    return;
  }

  // 로그 파일 삭제 여부 확인
  const logFile = path.join(LOGS_DIR, `${name}.log`);
  const logExists = await fs.pathExists(logFile);

  if (logExists) {
    const { deleteLogs } = await inquirer.prompt<{ deleteLogs: boolean }>([
      {
        type: 'confirm',
        name: 'deleteLogs',
        message: '관련 로그 파일도 삭제하시겠습니까?',
        default: false,
      },
    ]);

    if (deleteLogs) {
      await fs.remove(logFile);
      console.log(chalk.gray(`  로그 파일 삭제됨: ${logFile}`));
    }
  }

  // 잔여 락 파일 정리
  const lockFile = path.join(LOCKS_DIR, `${name}.lock`);
  if (await fs.pathExists(lockFile)) {
    await fs.remove(lockFile);
  }

  // jobs.json에서 작업 제거
  await removeJob(name);

  console.log(chalk.green(`\n  작업 "${name}"이(가) 삭제되었습니다.\n`));
}
