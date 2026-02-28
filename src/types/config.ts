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
  column_review_count?: string;
}

export interface NotionConfig extends ColumnConfig {
  /**
   * 사용자가 직접 Notion API를 사용하고 싶은 경우 사용
   * - true: Notion SDK 사용
   * - false: MCP 사용 (기본값)
   */
  use_api?: boolean;
  /**
   * 자동 재검토 최대 횟수 (기본값: 3)
   */
  max_review_count?: number;
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
   * Notion 데이터베이스 ID (32자 UUID, 하이픈 없음)
   * 예: 89d63e10550d445a9fbda3a7a4e3e0f9
   */
  database_id?: string;
  /**
   * @deprecated datasource_id는 더 이상 사용되지 않습니다. database_id를 사용하세요.
   */
  datasource_id?: string;
}

export interface SlackConfig {
  enabled?: boolean;
  webhook_url?: string;
}

export interface Workspace {
  name: string;
  working_dir: string;
  notion: NotionConfig;
}

export interface DailyAgentConfig {
  version: string;
  workspaces?: Workspace[];
  active_workspace?: string;
  slack?: SlackConfig;
}
