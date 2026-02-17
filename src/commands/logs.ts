import chalk from 'chalk';

import { isInitialized } from '../config';
import { getJob } from '../jobs';
import { formatFileSize, getJobLogFiles, tailLogFile } from '../utils/logs';

export async function logsCommand(name: string, options: {
  follow?: boolean;
  lines?: number;
} = {}): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const job = await getJob(name);
  if (!job) {
    console.log(chalk.red(`작업 "${name}"을(를) 찾을 수 없습니다.`));
    process.exit(1);
  }

  // Fetch all logs for this job
  const logs = await getJobLogFiles(name);

  if (logs.length === 0) {
    console.log(chalk.yellow(`\n  작업 "${name}"의 로그 파일이 없습니다.\n`));
    return;
  }

  if (options.follow) {
    // Follow mode: show latest log and monitor for changes
    const latestLog = logs[0]!;
    const linesToShow = options.lines ?? 10;
    await tailLogFile(latestLog.fullPath, linesToShow, true);
  } else {
    // List mode: show all available logs
    console.log(chalk.bold(`\n  작업 "${name}"의 로그 파일 목록\n`));

    const fileW = 50;
    const sizeW = 10;
    const dateW = 20;

    const header = [
      '파일명'.padEnd(fileW),
      '크기'.padEnd(sizeW),
      '날짜'.padEnd(dateW),
    ].join('  ');

    console.log(chalk.gray('  ' + header));
    console.log(chalk.gray('  ' + '-'.repeat(header.length)));

    for (const log of logs) {
      const sizeStr = formatFileSize(log.size);
      const dateStr = new Date(log.date).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

      const row = [
        chalk.cyan(log.file.padEnd(fileW)),
        sizeStr.padEnd(sizeW),
        chalk.gray(dateStr.padEnd(dateW)),
      ].join('  ');

      console.log('  ' + row);
    }

    console.log('');
    console.log(chalk.gray(`  팁: ${chalk.cyan(`dailyagent logs ${name} --lines 50`)} 으로 최신 로그 상위 50줄 표시`));
    console.log(chalk.gray(`  팁: ${chalk.cyan(`dailyagent logs ${name} --follow`)} 으로 실시간 로그 모니터링`));
    console.log('');
  }
}

