import { Logger } from "../logger";

export interface ClaudeOptions {
  prompt: string;
  workDir: string;
  settingsFile?: string | undefined;
  timeout?: string | undefined;
  logger?: Logger | undefined;
  model?: string | undefined;
}

export interface ClaudeResult<T> {
  rawOutput?: string;
  exitCode?: number;
  result?: T;
}


/**
 * Phase 1 결과 타입 : 실행할 태스크
 */
export interface TaskInfo {
  /**
   * 페이지 ID
   */
  task_id?: string;
  /**
   * 태스크 제목
   */
  task_title?: string;
  /**
   * 기준 브랜치
   */
  base_branch?: string;
  /**
   * 요구사항
   */
  requirements?: string;
  /**
   * 페이지 URL
   */
  page_url?: string;
}


/**
 * Phase 2 결과 타입 : 코드 작업 결과
 */
export interface WorkResult {
  /**
   * 성공 여부
   */
  success?: boolean;
  /**
   * 에러 메시지
   */
  error?: string;
  /**
   * 작업한 브랜치 명
   */
  branch_name?: string;
  /**
   * 커밋 목록
   */
  commits?: { hash: string; message: string }[];
  /**
   * 변경된 파일 목록
   */
  files_changed?: string[];
  /**
   * 요약
   */
  summary?: string;
  /**
   * PR URL
   */
  pr_url?: string;
  /**
   * PR 건너뛰기 이유
   */
  pr_skipped_reason?: string;
}

/**
 * Phase 3 결과 타입 : Notion 업데이트 결과
 */
export interface FinishResult {
  /**
   * 성공 여부
   */
  success: boolean;
  /**
   * 페이지 ID
   */
  task_id: string;
  /**
   * 태스크 제목
   */
  task_title: string;
  /**
   * 작업한 브랜치 명
   */
  branch_name: string;
  /**
   * 커밋 목록
   */
  commits: { hash: string; message: string }[];
  /**
   * 변경된 파일 목록
   */
  files_changed: string[];
  /**
   * PR URL
   */
  pr_url: string;
  /**
   * PR 건너뛰기 이유
   */
  pr_skipped_reason: string;
  /**
   * 요약
   */
  summary: string;
  /**
   * Notion 업데이트 여부
   */
  notion_updated: boolean;
  }