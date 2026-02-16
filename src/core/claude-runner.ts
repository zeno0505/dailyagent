import { spawn, execSync } from 'child_process';
import fs from 'fs-extra';
import type { Logger } from '../logger';
import { ClaudeOptions, ClaudeResult } from '../types/core';

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

export async function runClaude<T>({ 
  prompt, 
  workDir, 
  settingsFile, 
  timeout = '30m', 
  logger, 
  model 
}: ClaudeOptions): Promise<ClaudeResult<T>> {
  const timeoutMs = parseTimeout(timeout);

  // Verify claude CLI exists
  try {
    execSync('which claude', { stdio: 'ignore' });
  } catch {
    throw new Error('claude 명령어를 찾을 수 없습니다. Claude Code를 설치해주세요.');
  }

  const args = [
    '-p',
    '--output-format', 'json',
    '--no-session-persistence',
    '--dangerously-skip-permissions',
  ];

  if (model) {
    args.push('--model', model);
  }

  if (settingsFile && await fs.pathExists(settingsFile)) {
    args.push('--settings', settingsFile);
    if (logger) await logger.info(`설정 파일 사용: ${settingsFile}`);
  }

  return new Promise((resolve, reject) => {
    if (logger) logger.info('Claude Code 실행 시작');

    const child = spawn('claude', args, {
      cwd: workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
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

      if (logger) await logger.info(`Claude Code 실행 완료 (Exit Code: ${code})`);

      if (code !== 0) {
        reject(new Error(`Claude Code 실행 실패 (Exit Code: ${code})\n${stderr}`));
        return;
      }

      // Parse JSON result
      try {
        const result = JSON.parse(stdout) as T;
        resolve({ rawOutput: stdout, exitCode: code, result });
      } catch {
        const error = { rawOutput: stdout, exitCode: code };
        resolve(error);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`Claude Code 실행 오류: ${err.message}`));
    });
  });
}
