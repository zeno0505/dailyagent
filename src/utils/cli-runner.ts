import fs from 'fs-extra';
import { execFileSync } from 'child_process';
import { CliAgentConfig, RunnerOptions } from "../types/core.js";

export type Agent = 'claude-code' | 'cursor';

/**
 * 에이전트 토큰 사용량 조회 결과
 */
export interface TokenUsage {
  used: number;
  total: number;
  remaining: number;
  /** 사용된 토큰 비율 (0-100). 남은 비율은 `100 - usedPercentage` */
  usedPercentage: number;
}

/**
 * 토큰 체크 결과
 */
export interface TokenCheckResult {
  sufficient: boolean;
  usage?: TokenUsage;
  error?: string;
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

  const agnet: Agent = config.command === "claude" ? "claude-code" : "cursor";

  // Common: Add model parameter if specified
  if (model) {
    args.push('--model', parseValidModel(agnet, model));
  }

  // Session continuation support
  if (sessionId) {
    args.push('--resume', sessionId);
    if (logger) await logger.info(`세션 이어서 실행: ${sessionId}`);
  }

  // Claude Code specific: Add settings file if exists
  if (config.command === 'claude') {
    if (settingsFile && await fs.pathExists(settingsFile)) {
      args.push('--settings', settingsFile);
      if (logger) await logger.info(`설정 파일 사용: ${settingsFile}`);
    }
  }

  return args;
}

/**
 * 에이전트 토큰 사용량 조회
 * claude: "Used: 1000000 / 5000000 (20%)" 형식 파싱
 * cursor(agent CLI): --usage 미지원 시 null 반환 (안전한 폴백)
 */
export function getTokenUsage(agent: Agent): TokenUsage | null {
  try {
    const command = agent === 'claude-code' ? 'claude' : 'agent';

    // Verify CLI exists (args array prevents shell injection)
    try {
      execFileSync('which', [command], { stdio: 'ignore' });
    } catch {
      return null;
    }

    const output = execFileSync(command, ['--usage'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    // Parse usage output
    // Expected format: "Used: 1000000 / 5000000 (20%)"
    const match = output.match(/Used:\s*(\d+)\s*\/\s*(\d+)\s*\((\d+(?:\.\d+)?)%\)/);
    if (!match) {
      return null;
    }

    const used = parseInt(match[1]!, 10);
    const total = parseInt(match[2]!, 10);
    const usedPercentage = parseFloat(match[3]!);
    const remaining = total - used;

    return { used, total, remaining, usedPercentage };
  } catch {
    return null;
  }
}

/**
 * 토큰 충분 여부 체크
 * @param agent 에이전트 타입
 * @param minRemainingPercentage 최소 남은 토큰 비율 (기본값: 5%)
 * @param minRemainingTokens 최소 남은 토큰 수 (기본값: 100000)
 */
export function checkTokenSufficiency(
  agent: Agent,
  minRemainingPercentage: number = 5,
  minRemainingTokens: number = 100000
): TokenCheckResult {
  const usage = getTokenUsage(agent);

  if (!usage) {
    // 토큰 사용량 조회 실패 시 진행 허용 (안전한 폴백)
    return { sufficient: true };
  }

  const remainingPercentage = 100 - usage.usedPercentage;
  const sufficient =
    remainingPercentage >= minRemainingPercentage &&
    usage.remaining >= minRemainingTokens;

  if (!sufficient) {
    const error = `토큰 부족: 남은 토큰 ${usage.remaining.toLocaleString()} (${remainingPercentage.toFixed(1)}%), 최소 요구: ${minRemainingTokens.toLocaleString()} (${minRemainingPercentage}%)`;
    return { sufficient: false, usage, error };
  }

  return { sufficient: true, usage };
}
