import { spawn, execSync } from 'child_process';
import { RunnerOptions, RunnerResult, CliAgentConfig } from '../types/core';
import { AGENT_CONFIGS, getAgentArgs, getFilteredEnv, parseTimeout, sanitizeOutput } from '../utils/cli-runner';
import { ClaudeCliEnvelope, CursorCliEnvelope } from '../types/cli-runner';
import { extractJsonFromCodeBlock } from '../utils/markdown';
import chalk from 'chalk';


/**
 * Unified CLI runner for all agents
 */
export async function runCli<T>(
  config: CliAgentConfig,
  options: RunnerOptions
): Promise<RunnerResult<T>> {
  const { prompt, workDir,  timeout = '30m', logger, } = options;
  const timeoutMs = parseTimeout(timeout);

  // Verify CLI exists
  try {
    execSync(`which ${config.command}`, { stdio: 'ignore' });
  } catch {
    throw new Error(`${config.command} 명령어를 찾을 수 없습니다. ${config.displayName}를 설치해주세요.`);
  }

  const args = [...config.args];

  // Session mode: --no-session-persistence 설정 비활성화
  if (config.command === 'claude' && (options.sessionId || options.enableSessionPersistence)) {
    const idx = args.indexOf('--no-session-persistence');
    if (idx !== -1) args.splice(idx, 1);
  }

  // Add agent-specific arguments
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

      // Parse JSON result
      try {
        const response = JSON.parse(stdout) as ClaudeCliEnvelope | CursorCliEnvelope;
        const sanitized = sanitizeOutput(stdout); // SECURITY: Mask sensitive data

        // Handle empty result (common in session mode when model ends with tool use)
        if (!response.result || response.result.trim() === '') {
          if (logger) await logger.warn(`${config.displayName} 결과가 비어있습니다 (stop_reason: ${response.stop_reason})`);
          resolve({
            rawOutput: sanitized,
            exitCode: code,
            sessionId: response.session_id,
            // result is undefined - caller must handle this case
          });
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
