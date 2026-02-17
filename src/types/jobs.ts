import { Agent } from "../utils/cli-runner";

export type JobStatus = 'active' | 'paused' | 'stopped';
export type LastStatus = 'success' | 'error' | null;

export type PromptMode = 'default' | 'custom';

export interface Job {
  name: string;
  agent: Agent;
  model?: string;
  prompt_mode?: PromptMode;
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
