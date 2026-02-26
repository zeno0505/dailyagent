import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import type { ColumnConfig, DailyAgentConfig } from './types/config.js';

export const CONFIG_DIR = path.join(os.homedir(), '.dailyagent');
export const CONFIG_FILE = path.join(CONFIG_DIR, 'dailyagent.config.json');
export const JOBS_FILE = path.join(CONFIG_DIR, 'jobs.json');
export const LOGS_DIR = path.join(CONFIG_DIR, 'logs');
export const LOCKS_DIR = path.join(CONFIG_DIR, 'locks');
export const PROMPTS_DIR = path.join(CONFIG_DIR, 'prompts');

export const DEFAULT_CONFIG = {
  version: '2.0.0',
  slack: {
    enabled: false,
    webhook_url: '',
  },
  execution: {
    phase2_mode: 'single',
    phase2_plan_model: 'sonnet',
    phase2_impl_model: 'haiku',
    phase2_review_model: 'sonnet',
    phase2_plan_timeout: '10m',
    phase2_review_timeout: '10m',
  },
} as const;

export const DEFAULT_WORKSPACE_NOTION_CONFIG = {
  use_api: true,
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
  column_review_count: '검토 횟수',
  max_review_count: 3,
} as const;

export function resolveColumns(columns: ColumnConfig) {
  return {
    statusWait: columns.column_status_wait || DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_wait,
    statusReview: columns.column_status_review || DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_review,
    statusComplete: columns.column_status_complete || DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_complete,
    statusError: columns.column_status_error || DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_error,
    columnStatus: columns.column_status || DEFAULT_WORKSPACE_NOTION_CONFIG.column_status,
    columnPriority: columns.column_priority || DEFAULT_WORKSPACE_NOTION_CONFIG.column_priority,
    columnBaseBranch: columns.column_base_branch || DEFAULT_WORKSPACE_NOTION_CONFIG.column_base_branch,
    columnWorkBranch: columns.column_work_branch || DEFAULT_WORKSPACE_NOTION_CONFIG.column_work_branch,
    columnPrerequisite: columns.column_prerequisite || DEFAULT_WORKSPACE_NOTION_CONFIG.column_prerequisite,
    columnCreatedTime: columns.column_created_time || DEFAULT_WORKSPACE_NOTION_CONFIG.column_created_time,
    columnReviewCount: columns.column_review_count || DEFAULT_WORKSPACE_NOTION_CONFIG.column_review_count,
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
