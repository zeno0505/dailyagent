import { LOGS_DIR } from '../config';
import path from 'path';
import fs from 'fs-extra';
import chalk from 'chalk';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

export async function getJobLogFiles(jobName: string): Promise<Array<{ file: string; fullPath: string; date: number; size: number }>> {
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

function colorizeLogLine(line: string): string {
  if (line.includes('[ERROR]')) {
    return chalk.red(line);
  } else if (line.includes('[WARN]')) {
    return chalk.yellow(line);
  } else if (line.includes('[INFO]')) {
    return line;
  } else {
    return chalk.gray(line);
  }
}

async function readLastNLinesStream(
  filePath: string,
  numLines: number,
): Promise<{ lines: string[]; totalLines: number }> {
  const lineBuffer: string[] = [];

  return new Promise((resolve, reject) => {
    try {
      const stream = createReadStream(filePath, { encoding: 'utf-8' });
      const rl = createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      let totalLines = 0;

      rl.on('line', (line) => {
        lineBuffer.push(line);
        if (lineBuffer.length > numLines) {
          lineBuffer.shift();
        }
        totalLines++;
      });

      rl.on('close', () => {
        resolve({ lines: lineBuffer, totalLines });
      });

      rl.on('error', reject);
      stream.on('error', reject);
    } catch (error) {
      reject(error);
    }
  });
}

export async function tailLogFile(filePath: string, numLines: number, follow: boolean = false): Promise<void> {
  try {
    const readResult = await readLastNLinesStream(filePath, numLines);
    const lastLines = readResult.lines;
    const totalLines = readResult.totalLines;

    console.log(chalk.bold(`\n  로그 파일: ${path.basename(filePath)}\n`));
    console.log(chalk.gray('-'.repeat(80)));

    for (const line of lastLines) {
      console.log(colorizeLogLine(line));
    }

    console.log(chalk.gray('-'.repeat(80)));
    console.log(`\n  표시된 줄: ${lastLines.length}/${totalLines}\n`);

    if (!follow) {
      return;
    }

    // Follow mode: watch for file changes and display new lines
    let lastReadCount = totalLines;
    let watchClosed = false;
    let debounceTimer: NodeJS.Timeout | null = null;

    const printNewLinesStream = async () => {
      try {
        const readResult = await readLastNLinesStream(filePath, 1000);
        const newTotal = readResult.totalLines;
        const allLines = readResult.lines;

        if (newTotal > lastReadCount) {
          const numNewLines = newTotal - lastReadCount;
          const startIdx = Math.max(0, allLines.length - numNewLines);
          const newLines = allLines.slice(startIdx);

          for (const line of newLines) {
            console.log(colorizeLogLine(line));
          }
        }
        lastReadCount = newTotal;
      } catch (error) {
        if (!watchClosed) {
          console.error(chalk.red(`  파일 읽기 오류: ${error}`));
        }
      }
    };

    const debouncedPrintNewLines = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(printNewLinesStream, 100);
    };

    const watcher = fs.watch(filePath, debouncedPrintNewLines);

    console.log(chalk.cyan('  실시간 모니터링 중... (Ctrl+C로 종료)\n'));

    // Handle graceful shutdown (ensure handler is called only once)
    const handleShutdown = () => {
      if (watchClosed) return;
      watchClosed = true;

      if (debounceTimer) clearTimeout(debounceTimer);
      watcher.close();
      process.removeListener('SIGINT', handleShutdown);

      console.log(chalk.gray('\n  모니터링 종료\n'));
      process.exit(0);
    };

    process.on('SIGINT', handleShutdown);
  } catch (error) {
    console.error(chalk.red(`로그 파일을 읽을 수 없습니다: ${error}`));
    process.exit(1);
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]!;
}
