import { z } from 'zod';
import { Logger } from "../logger.js";

// ============================================================
// Runner infrastructure types (not AI output — no Zod schema)
// ============================================================

export interface RunnerOptions {
  prompt: string;
  workDir: string;
  settingsFile?: string | undefined;
  timeout?: string | undefined;
  logger?: Logger | undefined;
  model?: string | undefined;
  sessionId?: string | undefined;
  enableSessionPersistence?: boolean | undefined;
  /** Zod schema to validate the parsed AI JSON output */
  schema?: z.ZodType<unknown>;
  /** Max correction retries on Zod validation failure (default: 3) */
  maxZodRetries?: number;
}

export interface RunnerResult<T> {
  rawOutput?: string;
  exitCode?: number;
  result?: T;
  sessionId?: string;
}

export interface CliAgentConfig {
  command: string;
  args: string[];
  displayName: string;
}

// ============================================================
// Phase 1 — Notion task (fetched externally, no Zod schema)
// ============================================================

export interface TaskInfo {
  /** 페이지 ID */
  task_id?: string;
  /** 태스크 제목 */
  task_title?: string;
  /** 기준 브랜치 */
  base_branch?: string;
  /** 작업 브랜치 (검토 태스크에서 사용) */
  work_branch?: string;
  /** 요구사항 */
  requirements?: string;
  /** 페이지 URL */
  page_url?: string;
  /** 현재 검토 횟수 (검토 태스크에서 사용) */
  review_count?: number;
  /** 검토 모드 여부 */
  is_review?: boolean;
  /** 작업 모드 ('실행' | '계획' | '') */
  work_mode?: string;
}

// ============================================================
// Phase 2 — AI output schemas (single source of truth)
// ============================================================

/**
 * Phase 2 / Phase 2-3: 코드 작업 결과
 * generateWorkPrompt / generateReviewPrompt 반환 형식
 */
export const WorkResultSchema = z.object({
  branch_name: z.string(),
  commits: z.array(z.object({ hash: z.string(), message: z.string() })),
  files_changed: z.array(z.string()),
  summary: z.string(),
  pr_url: z.string().nullable(),
  pr_skipped_reason: z.string().nullable(),
  // Internal-only fields injected by executor on error — optional so schema
  // still accepts them when the object is used as a general WorkResult.
  success: z.boolean().optional(),
  error: z.string().optional(),
});
export type WorkResult = z.infer<typeof WorkResultSchema>;

/**
 * Phase 2-1: 개발 계획
 * generatePlanPrompt 반환 형식
 */
export const PlanResultSchema = z.object({
  plan_summary: z.string(),
  branch_name: z.string(),
  files_to_modify: z.array(z.string()),
  files_to_create: z.array(z.string()),
  implementation_steps: z.array(z.string()),
});
export type PlanResult = z.infer<typeof PlanResultSchema>;

/**
 * Phase 2-2: 구현 결과
 * generateImplementPrompt 반환 형식
 */
export const ImplResultSchema = z.object({
  commits: z.array(z.object({ hash: z.string(), message: z.string() })),
  files_changed: z.array(z.string()),
  issues_found: z.array(z.string()),
});
export type ImplResult = z.infer<typeof ImplResultSchema>;

/**
 * 계획 모드: 개별 세부 작업 항목
 */
export const PlanTaskItemSchema = z.object({
  id: z.string().optional(),
  summary: z.string(),
  detail: z.string(),
  priority: z.string(),
  depends_on: z.array(z.string()).optional(),
});
export type PlanTaskItem = z.infer<typeof PlanTaskItemSchema>;

/**
 * 계획 모드: AI 전체 결과
 * generateWorkModePlanPrompt 반환 형식
 */
export const WorkModePlanResultSchema = z.object({
  tasks: z.array(PlanTaskItemSchema),
});
export type WorkModePlanResult = z.infer<typeof WorkModePlanResultSchema>;

// ============================================================
// Phase 3 — Notion update results (internal, no Zod schema)
// ============================================================

export interface FinishResult {
  success: boolean;
  task_id: string;
  task_title: string;
  branch_name: string;
  commits: { hash: string; message: string }[];
  files_changed: string[];
  pr_url: string;
  pr_skipped_reason: string;
  summary: string;
  notion_updated: boolean;
}

export interface PlanModeResult {
  success: boolean;
  created_page_ids: string[];
  task_count: number;
  error?: string;
}

export interface PlanFinishResult {
  success: boolean;
  task_id: string;
  task_title: string;
  task_count: number;
  created_page_ids: string[];
  summary: string;
  notion_updated: boolean;
}

export interface JobSkippedResult {
  skipped: true;
  reason: 'paused';
}

export interface NoTasksResult {
  no_tasks: true;
}

/**
 * 토큰 부족으로 작업 패스 결과 타입
 */
export interface TokenInsufficientResult {
  token_insufficient: true;
  reason: string;
}

/**
 * executeJob 최종 반환 타입
 */
export type ExecuteJobResult =
  | FinishResult
  | PlanFinishResult
  | WorkResult
  | JobSkippedResult
  | NoTasksResult
  | TokenInsufficientResult;
