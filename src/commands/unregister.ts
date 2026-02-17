import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { isInitialized, LOGS_DIR, LOCKS_DIR, PROMPTS_DIR } from '../config';
import { getJob, removeJob } from '../jobs';
import { isJobInstalled, uninstallJob } from '../utils/schedule';

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

  const shouldDelete = await confirm({
    message: `작업 "${name}"을(를) 삭제하시겠습니까?`,
    default: false,
  });

  if (!shouldDelete) {
    console.log(chalk.yellow('\n  삭제가 취소되었습니다.\n'));
    return;
  }

  // 로그 파일 삭제 여부 확인
  const logFile = path.join(LOGS_DIR, `${name}.log`);
  const logExists = await fs.pathExists(logFile);

  if (logExists) {
    const deleteLogs = await confirm({
      message: '관련 로그 파일도 삭제하시겠습니까?',
      default: false,
    });

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

  // 커스텀 프롬프트 파일 삭제
  await fs.ensureDir(PROMPTS_DIR);
  const promptFile = path.join(PROMPTS_DIR, `${name}.md`);
  const promptExists = await fs.pathExists(promptFile);
  if (promptExists) {
    const deletePrompt = await confirm({
      message: '관련 프롬프트 파일도 삭제하시겠습니까?',
      default: false,
    });
    if (deletePrompt) {
      await fs.remove(promptFile);
      console.log(chalk.gray(`  프롬프트 파일 삭제됨: ${promptFile}`));
    }
  }

  // 스케줄링 등록 해제
  const scheduleInstalled = isJobInstalled(name);
  if (scheduleInstalled) {
    const deleteSchedule = await confirm({
      message: '등록된 스케줄링도 해제하시겠습니까?',
      default: true,
    });

    if (deleteSchedule) {
      try {
        uninstallJob(name);
        console.log(chalk.gray(`  스케줄링 해제됨 (${scheduleInstalled})`));
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.log(chalk.yellow(`  스케줄링 해제 실패: ${error}`));
      }
    }
  }

  // jobs.json에서 작업 제거
  await removeJob(name);

  console.log(chalk.green(`\n  작업 "${name}"이(가) 삭제되었습니다.\n`));
}
