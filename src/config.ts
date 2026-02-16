import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import type { DailyAgentConfig } from './types/config';

export const CONFIG_DIR = path.join(os.homedir(), '.dailyagent');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'dailyagent.config.json');
export const JOBS_FILE = path.join(CONFIG_DIR, 'jobs.json');
export const LOGS_DIR = path.join(CONFIG_DIR, 'logs');
export const LOCKS_DIR = path.join(CONFIG_DIR, 'locks');

export const DEFAULT_CONFIG: DailyAgentConfig = {
  version: '1.0.0',
  notion: {
    database_url: '',
    column_priority: '우선순위',
    column_status: '상태',
    column_status_wait: '작업 대기',
    column_status_complete: '검토 전',
    column_status_error: '작업 실패',
    column_base_branch: '기준 브랜치',
    column_work_branch: '작업 브랜치',
  },
};

export async function ensureConfigDir(): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
  await fs.ensureDir(LOGS_DIR);
  await fs.ensureDir(LOCKS_DIR);
}

export async function loadConfig(): Promise<DailyAgentConfig | null> {
  if (!(await fs.pathExists(CONFIG_FILE))) {
    return null;
  }
  return fs.readJson(CONFIG_FILE) as Promise<DailyAgentConfig>;
}

export async function saveConfig(config: DailyAgentConfig): Promise<void> {
  await ensureConfigDir();
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

export function isInitialized(): boolean {
  return fs.pathExistsSync(CONFIG_FILE);
}
