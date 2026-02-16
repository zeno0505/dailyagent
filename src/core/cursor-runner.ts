import { spawn, execSync } from 'child_process';
import fs from 'fs-extra';
import type { Logger } from '../logger';
import { ClaudeOptions, ClaudeResult } from '../types/core';
import { parseTimeout } from './claude-runner';

export async function runCursor<T>({
  prompt,
  workDir,
  settingsFile,
  timeout = '30m',
  logger,
  model
}: ClaudeOptions): Promise<ClaudeResult<T>> {
  const timeoutMs = parseTimeout(timeout);

  // Verify cursor CLI exists
  try {
    execSync('which cursor', { stdio: 'ignore' });
  } catch {
    throw new Error('cursor 명령어를 찾을 수 없습니다. Cursor CLI를 설치해주세요.');
  }

  const args = [
    'code',
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
    if (logger) logger.info('Cursor Code 실행 시작');

    const child = spawn('cursor', args, {
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

      if (logger) await logger.info(`Cursor Code 실행 완료 (Exit Code: ${code})`);

      if (code !== 0) {
        reject(new Error(`Cursor Code 실행 실패 (Exit Code: ${code})\n${stderr}`));
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
      reject(new Error(`Cursor Code 실행 오류: ${err.message}`));
    });
  });
}
