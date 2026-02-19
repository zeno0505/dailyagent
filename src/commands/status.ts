import chalk from 'chalk';
import fs from 'fs-extra';
import { isInitialized, LOGS_DIR, loadConfig } from '../config.js';
import { getJob } from '../jobs.js';
import { getWorkspace } from '../workspace.js';

const DEFAULT_HISTORY_COUNT = 10;

interface StatusOptions {
  count?: number;
}

export async function statusCommand(name: string, options: StatusOptions = {}): Promise<void> {
  const config = await loadConfig();
  if (!config || !isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const job = await getJob(name);
  if (!job) {
    console.log(chalk.red(`작업 "${name}"을(를) 찾을 수 없습니다.`));
    process.exit(1);
  }

  const workspace = await getWorkspace(job.workspace || config.active_workspace || 'default');
  if (!workspace) {
    console.log(chalk.red(`\n  Workspace "${job.workspace || config.active_workspace || 'default'}"을(를) 찾을 수 없습니다.`));
    process.exit(1);
  }

  // 작업 설정 정보
  console.log(chalk.bold(`\n  작업 상태: ${name}\n`));

  console.log(chalk.cyan('  [설정 정보]'));
  console.log(`    작업 디렉토리  : ${workspace.working_dir}`);
  console.log(`    에이전트       : ${job.agent || '-'}`);
  console.log(`    스케줄         : ${job.schedule}`);
  console.log(`    타임아웃       : ${job.timeout || '30m'}`);
  console.log(`    등록일         : ${formatDate(job.created_at)}`);
  console.log('');

  // 현재 상태
  console.log(chalk.cyan('  [현재 상태]'));
  console.log(`    작업 상태      : ${formatStatus(job.status)}`);
  console.log(`    마지막 실행    : ${formatDate(job.last_run)}`);
  console.log(`    마지막 결과    : ${formatLastStatus(job.last_status)}`);
  console.log('');

  // 실행 이력 (로그 파일 기반)
  const historyCount = options.count || DEFAULT_HISTORY_COUNT;
  const logs = await getJobLogs(name, historyCount);

  console.log(chalk.cyan(`  [최근 실행 이력 (최대 ${historyCount}회)]`));
  if (logs.length === 0) {
    console.log(chalk.gray('    실행 이력이 없습니다.'));
  } else {
    for (const log of logs) {
      console.log(`    ${chalk.gray(log.date)}  ${log.file}`);
    }
  }
  console.log('');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return chalk.gray('-');
  return new Date(dateStr).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

function formatStatus(status: string): string {
  if (status === 'active') return chalk.green('활성');
  if (status === 'paused') return chalk.yellow('일시 중지');
  return chalk.gray(status || '-');
}

function formatLastStatus(status: string | null): string {
  if (!status) return chalk.gray('-');
  if (status === 'success') return chalk.green('성공');
  if (status === 'error') return chalk.red('에러');
  if (status === 'no_tasks') return chalk.gray('대기 작업 없음');
  return chalk.gray(status);
}

async function getJobLogs(jobName: string, count: number): Promise<Array<{ file: string; date: string }>> {
  if (!(await fs.pathExists(LOGS_DIR))) return [];

  const files = await fs.readdir(LOGS_DIR);
  const jobLogs = files
    .filter((f) => f.startsWith(`${jobName}-`) && f.endsWith('.log'))
    .sort()
    .reverse()
    .slice(0, count);

  return jobLogs.map((file) => {
    // 파일명: jobName-2025-01-15_12-30-00.log → 날짜 추출
    const tsMatch = file.match(/\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}/);
    const date = tsMatch
      ? tsMatch[0]!.replace('_', ' ').replace(/-/g, (m, offset) => (offset > 10 ? ':' : '-'))
      : '-';
    return { file, date };
  });
}
