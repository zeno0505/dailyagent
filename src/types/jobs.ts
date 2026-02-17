import { Agent } from "../utils/cli-runner";

export type JobStatus = 'active' | 'paused' | 'stopped';
export type LastStatus = 'success' | 'error' | null;

export type PromptMode = 'default' | 'custom';

export type Phase2Mode = 'single' | 'session';

export interface ExecutionConfig {
  /** Phase 2 실행 모드: 'single' (기존 단일) | 'session' (분할 실행) */
  phase2_mode?: Phase2Mode;
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
  execution?: ExecutionConfig;
}

export interface JobsData {
  jobs: Job[];
}
