import { spawn, execSync } from 'child_process';
import { RunnerOptions, RunnerResult, CliAgentConfig } from '../types/core.js';
import { AGENT_CONFIGS, getAgentArgs, getFilteredEnv, parseTimeout, sanitizeOutput } from '../utils/cli-runner.js';
import { ClaudeCliEnvelope, CursorCliEnvelope } from '../types/cli-runner.js';
import { extractJsonFromCodeBlock } from '../utils/markdown.js';
import chalk from 'chalk';

const DEFAULT_MAX_ZOD_RETRIES = 3;

/**
 * Single spawn attempt — parses JSON but does NOT run Zod validation.
 * Returns raw RunnerResult (result may be undefined if parsing fails).
 */
async function spawnCli<T>(
  config: CliAgentConfig,
  options: RunnerOptions,
): Promise<RunnerResult<T>> {
  const { prompt, workDir, timeout = '30m', logger } = options;
  const timeoutMs = parseTimeout(timeout);

  const args = [...config.args];

  // Session mode: disable --no-session-persistence
  if (config.command === 'claude' && (options.sessionId || options.enableSessionPersistence)) {
    const idx = args.indexOf('--no-session-persistence');
    if (idx !== -1) args.splice(idx, 1);
  }

  const additionalArgs = await getAgentArgs(config, options);
  args.push(...additionalArgs);

  return new Promise((resolve, reject) => {
    if (logger) logger.info(`${config.displayName} 실행 시작`);

    const child = spawn(config.command, args, {
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: getFilteredEnv(), // SECURITY: Use filtered environment
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
    child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

    child.stdin?.write(prompt);
    child.stdin?.end();

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`작업이 타임아웃되었습니다 (${timeout}).`));
    }, timeoutMs);

    child.on('close', async (code) => {
      clearTimeout(timer);
      console.log(chalk.gray('--------------------------------'));
      console.log(chalk.gray(`${config.displayName} 실행 완료 (Exit Code: ${code})`));
      console.log(chalk.gray('--------------------------------'));
      console.log(chalk.gray('STDOUT:'));
      console.log(chalk.gray(stdout));
      console.log(chalk.gray('--------------------------------'));
      console.log(chalk.gray('STDERR:'));
      console.log(chalk.gray(stderr));
      console.log(chalk.gray('--------------------------------'));

      if (logger) await logger.info(`${config.displayName} 실행 완료 (Exit Code: ${code})`);

      if (code !== 0) {
        reject(new Error(`${config.displayName} 실행 실패 (Exit Code: ${code})\n${stderr}`));
        return;
      }

      try {
        const response = JSON.parse(stdout) as ClaudeCliEnvelope | CursorCliEnvelope;
        const sanitized = sanitizeOutput(stdout); // SECURITY: Mask sensitive data

        if (!response.result || response.result.trim() === '') {
          if (logger) await logger.warn(`${config.displayName} 결과가 비어있습니다 (stop_reason: ${response.stop_reason ?? 'N/A'})`);
          resolve({ rawOutput: sanitized, exitCode: code, sessionId: response.session_id });
          return;
        }

        resolve({
          rawOutput: sanitized,
          exitCode: code,
          result: JSON.parse(extractJsonFromCodeBlock(response.result)) as T,
          sessionId: response.session_id,
        });
      } catch (err) {
        const sanitized = sanitizeOutput(stdout); // SECURITY: Mask sensitive data
        if (logger) await logger.error(`${config.displayName} 결과 파싱 실패: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
        resolve({ rawOutput: sanitized, exitCode: code });
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`${config.displayName} 실행 오류: ${err.message}`));
    });
  });
}

/**
 * Unified CLI runner for all agents.
 *
 * When `options.schema` is provided the parsed result is validated with Zod.
 * On failure the session is continued with a correction prompt (up to
 * `options.maxZodRetries` times, default 3).
 */
export async function runCli<T>(
  config: CliAgentConfig,
  options: RunnerOptions,
): Promise<RunnerResult<T>> {
  // Verify CLI exists once before any attempt
  try {
    execSync(`which ${config.command}`, { stdio: 'ignore' });
  } catch {
    throw new Error(`${config.command} 명령어를 찾을 수 없습니다. ${config.displayName}를 설치해주세요.`);
  }

  const { schema, maxZodRetries = DEFAULT_MAX_ZOD_RETRIES, logger } = options;

  let currentOptions = options;
  let lastResult: RunnerResult<T> | undefined;

  for (let attempt = 0; attempt <= maxZodRetries; attempt++) {
    lastResult = await spawnCli<T>(config, currentOptions);

    // No schema provided — return as-is (original behaviour)
    if (!schema) return lastResult;

    // No parsed result — nothing to validate, return as-is
    if (!lastResult.result) return lastResult;

    const validation = schema.safeParse(lastResult.result);

    if (validation.success) {
      // Replace result with Zod-parsed (coerced/stripped) value
      return { ...lastResult, result: validation.data as T };
    }

    const isLastAttempt = attempt === maxZodRetries;

    if (isLastAttempt) {
      if (logger) {
        await logger.error(
          `Zod 검증 최종 실패 (${maxZodRetries}회 교정 시도): ${JSON.stringify(validation.error.issues)}`
        );
      }
      // Return without result so caller can handle the failure
      // (omit `result` key entirely to satisfy exactOptionalPropertyTypes)
      const { result: _discarded, ...rest } = lastResult;
      return rest;
    }

    // Build correction prompt from Zod error issues
    const errorLines = validation.error.issues
      .map(issue => `- ${issue.path.length > 0 ? issue.path.join('.') : '(root)'}: ${issue.message}`)
      .join('\n');

    const correctionPrompt =
      `이전에 출력한 JSON이 스키마 검증에 실패했습니다. (${attempt + 1}/${maxZodRetries}회)\n` +
      `다음 검증 오류를 수정하여 올바른 JSON을 다시 출력해주세요:\n\n` +
      `검증 오류:\n${errorLines}\n\n` +
      `반드시 JSON만 출력하고 다른 텍스트는 포함하지 마세요.`;

    if (logger) {
      await logger.warn(
        `Zod 검증 실패 — 세션으로 교정 요청 (${attempt + 1}/${maxZodRetries}회):\n${errorLines}`
      );
    }

    // Continue the existing session for the correction follow-up
    currentOptions = {
      ...options,
      prompt: correctionPrompt,
      sessionId: lastResult.sessionId,
      enableSessionPersistence: true,
    };
  }

  // Unreachable, but TypeScript requires a return
  return lastResult!;
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
