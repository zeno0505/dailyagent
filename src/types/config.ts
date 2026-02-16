export interface ColumnConfig {
  column_status?: string;
  column_status_wait?: string;
  column_status_complete?: string;
  column_status_error?: string;
  column_priority?: string;
  column_base_branch?: string;
  column_work_branch?: string;
}

export interface NotionConfig extends ColumnConfig {
  database_url: string;
  use_api?: boolean; // true: Notion API 사용, false: MCP 사용 (기본값)
  api_token?: string; // Notion API 토큰 (use_api가 true일 때 필요)
}

export interface DailyAgentConfig {
  version: string;
  notion: NotionConfig;
}
