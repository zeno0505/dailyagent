export type JobStatus = 'active' | 'paused' | 'stopped';
export type LastStatus = 'success' | 'error' | null;
export type Agent = 'claude-code' | 'cursor';

export interface Job {
  name: string;
  agent: Agent;
  model?: string;
  working_dir: string;
  schedule: string;
  timeout?: string;
  status: JobStatus;
  created_at: string;
  last_run: string | null;
  last_status: LastStatus;
}

export interface JobsData {
  jobs: Job[];
}
