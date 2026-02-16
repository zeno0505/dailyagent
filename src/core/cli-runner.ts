import { spawn, execSync } from 'child_process';
import fs from 'fs-extra';
import { RunnerOptions, RunnerResult, CliAgentConfig } from '../types/core';
import { Agent } from '../types/jobs';

/**
 * Parse timeout string (e.g., "30m" → 1800000)
 */
export function parseTimeout(timeoutStr: string): number {
  const match = timeoutStr.match(/^(\d+)(s|m|h)$/);
  if (!match) return 30 * 60 * 1000; // default 30m
  const val = parseInt(match[1]!, 10);
  const unit = match[2]! as 's' | 'm' | 'h';
  const multipliers: Record<'s' | 'm' | 'h', number> = {
    s: 1000,
    m: 60 * 1000,
    h: 3600 * 1000
  };
  return val * multipliers[unit];
}

/**
 * Get filtered environment variables (whitelist approach for security)
 * Only includes: PATH, HOME, USER, SSH_AUTH_SOCK for safe execution
 */
export function getFilteredEnv(): Record<string, string> {
  const whitelist = [
    'PATH',
    'HOME',
    'USER',
    'SSH_AUTH_SOCK', // For Git SSH authentication
  ];

  const filtered: Record<string, string> = {};
  for (const key of whitelist) {
    const value = process.env[key];
    if (value) {
      filtered[key] = value;
    }
  }

  return filtered;
}

/**
 * Sanitize output by masking sensitive information (API keys, tokens, etc.)
 */
export function sanitizeOutput(output: string): string {
  // OpenAI API keys
  let sanitized = output.replace(/sk-[a-zA-Z0-9]{32,}/g, 'sk-***');

  // GitHub PAT
  sanitized = sanitized.replace(/ghp_[a-zA-Z0-9]{36,}/g, 'ghp-***');

  // Bearer tokens
  sanitized = sanitized.replace(/Bearer [a-zA-Z0-9\-_.~+/]+=*/gi, 'Bearer ***');

  // Notion secrets
  sanitized = sanitized.replace(/secret_[a-zA-Z0-9]{43}/g, 'secret_***');

  // Generic API tokens (auth: token pattern)
  sanitized = sanitized.replace(/(?:api[_-])?key["\s:=]+[a-zA-Z0-9\-_.~+/]+=*/gi, 'key: ***');

  return sanitized;
}

/**
 * CLI Agent configurations
 */
const AGENT_CONFIGS: Record<Agent, CliAgentConfig> = {
  'claude-code': {
    command: 'claude',
    args: [
      '-p',
      '--output-format', 'json',
      '--no-session-persistence',
    ],
    displayName: 'Claude Code',
  },
  'cursor': {
    command: 'agent',
    args: [
      '-p',
      '--output-format', 'json',
    ],
    displayName: 'Cursor Agent',
  },
};

async function getAgentArgs(args: string[], options: RunnerOptions) {
  const { model, logger, settingsFile } = options;

  // Common
  if (model) {
    args.push('--model', model);
  }

  // Claude Code
  if (model === 'claude-code') {
    if (settingsFile && await fs.pathExists(settingsFile)) {
      args.push('--settings', settingsFile);
      if (logger) await logger.info(`설정 파일 사용: ${settingsFile}`);
    }
  }

  return args;
}

/**
 * Unified CLI runner for all agents
 */
export async function runCli<T>(
  config: CliAgentConfig,
  options: RunnerOptions
): Promise<RunnerResult<T>> {
  const { prompt, workDir, settingsFile, timeout = '30m', logger, model } = options;
  const timeoutMs = parseTimeout(timeout);

  // Verify CLI exists
  try {
    execSync(`which ${config.command}`, { stdio: 'ignore' });
  } catch {
    throw new Error(`${config.command} 명령어를 찾을 수 없습니다. ${config.displayName}를 설치해주세요.`);
  }

  const args = [...config.args];

  args.push(...(await getAgentArgs(args, options)));
  
  return new Promise((resolve, reject) => {
    if (logger) logger.info(`${config.displayName} 실행 시작`);

    const child = spawn(config.command, args, {
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: getFilteredEnv(), // SECURITY: Use filtered environment
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    // Send prompt via stdin
    child.stdin?.write(prompt);
    child.stdin?.end();

    // Timeout handling
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`작업이 타임아웃되었습니다 (${timeout}).`));
    }, timeoutMs);

    child.on('close', async (code) => {
      clearTimeout(timer);

      if (logger) await logger.info(`${config.displayName} 실행 완료 (Exit Code: ${code})`);

      if (code !== 0) {
        reject(new Error(`${config.displayName} 실행 실패 (Exit Code: ${code})\n${stderr}`));
        return;
      }

      // Parse JSON result
      try {
        const result = JSON.parse(stdout) as T;
        const sanitized = sanitizeOutput(stdout); // SECURITY: Mask sensitive data
        resolve({ rawOutput: sanitized, exitCode: code, result });
      } catch {
        const sanitized = sanitizeOutput(stdout); // SECURITY: Mask sensitive data
        const error = { rawOutput: sanitized, exitCode: code };
        resolve(error);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`${config.displayName} 실행 오류: ${err.message}`));
    });
  });
}

/**
 * Run Claude Code
 */
export async function runClaude<T>(options: RunnerOptions): Promise<RunnerResult<T>> {
  return runCli<T>(AGENT_CONFIGS['claude-code'], options);
}

/**
 * Run Cursor Agent
 */
export async function runCursor<T>(options: RunnerOptions): Promise<RunnerResult<T>> {
  return runCli<T>(AGENT_CONFIGS.cursor, options);
}
