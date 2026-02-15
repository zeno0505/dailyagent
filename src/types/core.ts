export interface PromptOptions {
  taskTitle: string;
  taskDescription: string;
  notionPageUrl: string;
  baseBranch: string;
  workBranch: string;
  priority: string;
}

export interface ClaudeResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode: number;
}

export interface ExecutionResult {
  success: boolean;
  message: string;
  details?: {
    prompt?: string;
    claudeOutput?: string;
    error?: string;
  };
}
