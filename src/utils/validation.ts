import chalk from 'chalk';
import { isInitialized, loadConfig } from '../config.js';
import { getJob } from '../jobs.js';
import type { DailyAgentConfig } from '../types/config.js';
import type { Job } from '../types/jobs.js';

/**
 * 초기화 여부를 확인합니다.
 */
export function requireInitialized(): void {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }
}

/**
 * 설정 로드 + 초기화 여부를 확인합니다.
 */
export async function requireConfig(): Promise<DailyAgentConfig> {
  const config = await loadConfig();
  if (!config || !isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }
  return config;
}

/**
 * 작업 존재 여부를 확인하고 작업 객체를 반환합니다.
 */
export async function requireJob(name: string): Promise<Job> {
  const job = await getJob(name);
  if (!job) {
    console.log(chalk.red(`\n  작업 "${name}"을(를) 찾을 수 없습니다.`));
    console.log(`  ${chalk.cyan('dailyagent list')} 명령으로 작업 목록을 확인하세요.\n`);
    process.exit(1);
  }
  return job;
}
