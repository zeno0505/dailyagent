export interface NotionConfig {
  database_url: string;
  column_priority: string;
  column_status: string;
  column_status_wait: string;
  column_status_complete: string;
  column_base_branch: string;
  column_work_branch: string;
}

export interface DailyAgentConfig {
  version: string;
  notion: NotionConfig;
}
