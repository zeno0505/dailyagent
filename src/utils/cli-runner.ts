import fs from 'fs-extra';
import { execFileSync } from 'child_process';
import { CliAgentConfig, RunnerOptions } from '../types/core.js';

export type Agent = 'claude-code' | 'cursor';

/**
 * headless 방식에서는 실제 사용량 조회 불가 — 실행 중 에러로 감지
 */
export class TokenExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenExhaustedError';
  }
}

/**
 * 토큰 소진 여부를 나타내는 에러 메시지 패턴 매칭
 *
 * 실제 확인된 메시지 예시:
 *   "You've hit your limit · resets 2am (Asia/Seoul)"  ← Claude Max 세션 소진
 */
const USAGE_LIMIT_RE =
  /hit your limit|usage limit|rate limit|quota exceeded|too many requests|daily limit|monthly limit|plan limit|limit reached|context window/i;

export function isUsageLimitError(text: string): boolean {
  return !!text && USAGE_LIMIT_RE.test(text);
}

/**
 * Cursor CLI 로 실행하는데, Claude 모델이 설정되어있는 경우 임시 파싱
 */
export function parseValidModel(agent: Agent, model: string): string {
  if (agent === 'cursor') {
    switch (model) {
      case "opus": return "opus-4.5-thinking";
      case "sonnet": return "sonnet-4.5-thinking";
      case "haiku": return "auto"; // Cursor 는 Haiku 모델을 지원하지 않음
      default: return model;
    }
  }
  return model;
}

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
export const AGENT_CONFIGS: Record<Agent, CliAgentConfig> = {
  'claude-code': {
    command: 'claude',
    args: [
      '-p',
      '--output-format', 'json',
      '--no-session-persistence',
      '--dangerously-skip-permissions',
    ],
    displayName: 'Claude Code',
  },
  'cursor': {
    command: 'agent',
    args: [
      '-p',
      '--output-format', 'json',
      '--approve-mcps',
      '--trust',
      '--yolo',
    ],
    displayName: 'Cursor Agent',
  },
};

export async function getAgentArgs(config: CliAgentConfig, options: RunnerOptions) {
  const { model, logger, settingsFile, sessionId } = options;
  const args: string[] = [];

  const agent: Agent = config.command === "claude" ? "claude-code" : "cursor";

  if (model) {
    args.push('--model', parseValidModel(agent, model));
  }

  if (sessionId) {
    args.push('--resume', sessionId);
    if (logger) await logger.info(`세션 이어서 실행: ${sessionId}`);
  }

  if (config.command === 'claude' && settingsFile && await fs.pathExists(settingsFile)) {
    args.push('--settings', settingsFile);
    if (logger) await logger.info(`설정 파일 사용: ${settingsFile}`);
  }

  return args;
}

