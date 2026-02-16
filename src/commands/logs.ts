import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { isInitialized, LOGS_DIR } from '../config';
import { getJob } from '../jobs';

interface LogsOptions {
  follow?: boolean;
  lines?: number;
}

export async function logsCommand(name: string, options: LogsOptions = {}): Promise<void> {
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
    // Follow mode: show latest log and tail it
    const latestLog = logs[0]!;
    await tailLogFile(latestLog.fullPath, options.lines || 10);
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

async function getJobLogFiles(jobName: string): Promise<Array<{ file: string; fullPath: string; date: number; size: number }>> {
  if (!(await fs.pathExists(LOGS_DIR))) return [];

  const files = await fs.readdir(LOGS_DIR);
  const jobLogs = files.filter((f) => f.startsWith(`${jobName}-`) && f.endsWith('.log'));

  const logsWithStats = await Promise.all(
    jobLogs.map(async (file) => {
      const fullPath = path.join(LOGS_DIR, file);
      const stats = await fs.stat(fullPath);
      return {
        file,
        fullPath,
        date: stats.mtimeMs,
        size: stats.size,
      };
    }),
  );

  return logsWithStats.sort((a, b) => b.date - a.date);
}

async function tailLogFile(filePath: string, lines: number): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const allLines = content.split('\n').filter((line) => line.length > 0);
  const lastLines = allLines.slice(Math.max(0, allLines.length - lines));

  console.log(chalk.bold(`\n  로그 파일: ${path.basename(filePath)}\n`));
  console.log(chalk.gray('-'.repeat(80)));

  for (const line of lastLines) {
    // Color code based on log level
    if (line.includes('[ERROR]')) {
      console.log(chalk.red(line));
    } else if (line.includes('[WARN]')) {
      console.log(chalk.yellow(line));
    } else if (line.includes('[INFO]')) {
      console.log(line);
    } else {
      console.log(chalk.gray(line));
    }
  }

  console.log(chalk.gray('-'.repeat(80)));
  console.log(`\n  표시된 줄: ${lastLines.length}/${allLines.length}\n`);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]!;
}
