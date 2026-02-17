export interface ColumnConfig {
  column_status?: string;
  column_status_wait?: string;
  column_status_review?: string;
  column_status_complete?: string;
  column_status_error?: string;
  column_priority?: string;
  column_base_branch?: string;
  column_work_branch?: string;
  column_prerequisite?: string;
  column_created_time?: string;
}

export interface NotionConfig extends ColumnConfig {
  /**
   * 사용자가 직접 Notion API를 사용하고 싶은 경우 사용
   * - true: Notion API 사용
   * - false: MCP 사용 (기본값)
   */
  use_api?: boolean;
  /**
   * (use_api가 false일 때 사용)
   * Notion 데이터베이스 URL
   */
  database_url?: string;
  /**
   * (use_api가 true일 때 사용)
   * Notion API 토큰
   */
  api_token?: string;
  /**
   * (use_api가 true일 때 사용)
   * Notion 데이터소스 ID
   */
  datasource_id?: string;
}

export interface SlackConfig {
  enabled?: boolean;
  webhook_url?: string;
}

export interface ExecutionConfig {
  /** Phase 2 실행 모드: 'single' (기존 단일) | 'session' (분할 실행) */
  phase2_mode?: 'single' | 'session';
  /** Phase 2-1 (계획) 실행 모델 */
  phase2_plan_model?: string;
  /** Phase 2-2 (구현) 실행 모델 */
  phase2_impl_model?: string;
  /** Phase 2-3 (검토) 실행 모델 */
  phase2_review_model?: string;
  /** Phase 2-1 (계획) 타임아웃 */
  phase2_plan_timeout?: string;
  /** Phase 2-3 (검토) 타임아웃 */
  phase2_review_timeout?: string;
}

export interface DailyAgentConfig {
  version: string;
  notion: NotionConfig;
  slack?: SlackConfig;
  execution?: ExecutionConfig;
}
