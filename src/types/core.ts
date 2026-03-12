import { Logger } from "../logger.js";

export interface RunnerOptions {
  prompt: string;
  workDir: string;
  settingsFile?: string | undefined;
  timeout?: string | undefined;
  logger?: Logger | undefined;
  model?: string | undefined;
  sessionId?: string | undefined;
  enableSessionPersistence?: boolean | undefined;
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
   * 작업 브랜치 (검토 태스크에서 사용)
   */
  work_branch?: string;
  /**
   * 요구사항
   */
  requirements?: string;
  /**
   * 페이지 URL
   */
  page_url?: string;
  /**
   * 현재 검토 횟수 (검토 태스크에서 사용)
   */
  review_count?: number;
  /**
   * 검토 모드 여부
   */
  is_review?: boolean;
  /**
   * 작업 모드 ('실행' | '계획' | '')
   */
  work_mode?: string;
  /**
   * PR 번호 (재검토 시 PR 리뷰 확인에 사용)
   */
  pr_number?: string;
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

/**
 * Phase 2-1 결과 타입: 개발 계획
 */
export interface PlanResult {
  plan_summary: string;
  branch_name: string;
  files_to_modify: string[];
  files_to_create: string[];
  implementation_steps: string[];
}

/**
 * 계획 모드에서 생성되는 개별 작업 항목
 */
export interface PlanTaskItem {
  id?: string;         // 작업 식별자 (의존성 참조용, 예: "task-1")
  summary: string;     // 간결한 작업 제목 (1문장, Notion 페이지 제목으로 사용)
  detail: string;      // 상세 작업 설명 (2-3문장, Notion 페이지 본문으로 사용)
  priority: string;    // "P1"-"P5"
  depends_on?: string[]; // 이 작업이 의존하는 작업의 id 배열 (선행 작업)
}

/**
 * 계획 모드 AI 결과 타입
 */
export interface WorkModePlanResult {
  tasks: PlanTaskItem[];
}

/**
 * 계획 모드 실행 결과 타입
 */
export interface PlanModeResult {
  success: boolean;
  created_page_ids: string[];
  task_count: number;
  error?: string;
}

/**
 * 계획 모드 Phase 3(Notion) 반영 결과 타입
 */
export interface PlanFinishResult {
  success: boolean;
  task_id: string;
  task_title: string;
  task_count: number;
  created_page_ids: string[];
  summary: string;
  notion_updated: boolean;
}

/**
 * 실행 조기 종료(중지) 결과 타입
 */
export interface JobSkippedResult {
  skipped: true;
  reason: 'paused';
}

/**
 * 실행 가능 작업 없음 결과 타입
 */
export interface NoTasksResult {
  no_tasks: true;
}

/**
 * executeJob 최종 반환 타입
 */
export type ExecuteJobResult =
  | FinishResult
  | PlanFinishResult
  | WorkResult
  | JobSkippedResult
  | NoTasksResult;

/**
 * Phase 2-2 결과 타입: 구현 결과
 */
export interface ImplResult {
  commits: { hash: string; message: string }[];
  files_changed: string[];
  issues_found: string[];
}