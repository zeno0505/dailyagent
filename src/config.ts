import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import type { ColumnConfig, DailyAgentConfig } from './types/config';

export const CONFIG_DIR = path.join(os.homedir(), '.dailyagent');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'dailyagent.config.json');
export const JOBS_FILE = path.join(CONFIG_DIR, 'jobs.json');
export const LOGS_DIR = path.join(CONFIG_DIR, 'logs');
export const LOCKS_DIR = path.join(CONFIG_DIR, 'locks');
export const PROMPTS_DIR = path.join(CONFIG_DIR, 'prompts');

export const DEFAULT_CONFIG = {
  version: '1.0.0',
  notion: {
    database_url: '',
    column_priority: '우선순위',
    column_status: '상태',
    column_status_wait: '작업 대기',
    column_status_review: '검토 전',
    column_status_complete: '완료',
    column_status_error: '작업 실패',
    column_base_branch: '기준 브랜치',
    column_work_branch: '작업 브랜치',
    column_prerequisite: '선행 작업',
    column_created_time: '날짜',
  },
  slack: {
    enabled: false,
    webhook_url: '',
  },
} as const;

export function resolveColumns(columns: ColumnConfig) {
  return {
    statusWait: columns.column_status_wait || DEFAULT_CONFIG.notion.column_status_wait,
    statusReview: columns.column_status_review || DEFAULT_CONFIG.notion.column_status_review,
    statusComplete: columns.column_status_complete || DEFAULT_CONFIG.notion.column_status_complete,
    statusError: columns.column_status_error || DEFAULT_CONFIG.notion.column_status_error,
    columnStatus: columns.column_status || DEFAULT_CONFIG.notion.column_status,
    columnPriority: columns.column_priority || DEFAULT_CONFIG.notion.column_priority,
    columnBaseBranch: columns.column_base_branch || DEFAULT_CONFIG.notion.column_base_branch,
    columnWorkBranch: columns.column_work_branch || DEFAULT_CONFIG.notion.column_work_branch,
    columnPrerequisite: columns.column_prerequisite || DEFAULT_CONFIG.notion.column_prerequisite,
    columnCreatedTime: columns.column_created_time || DEFAULT_CONFIG.notion.column_created_time,
  }
}

export async function ensureConfigDir(): Promise<void> {
  await fs.ensureDir(CONFIG_DIR);
  await fs.ensureDir(LOGS_DIR);
  await fs.ensureDir(LOCKS_DIR);
  await fs.ensureDir(PROMPTS_DIR);
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
