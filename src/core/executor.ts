import { loadConfig } from '../config';
import { getJob, updateJob, acquireLock, releaseLock } from '../jobs';
import { Logger } from '../logger';
import { generateInitialPrompt, generateWorkPrompt, generateFinishPrompt } from './prompt-generator';
import { runClaude, runCursor } from './cli-runner';
import chalk from 'chalk';
import { TaskInfo, WorkResult } from '../types/core';
import { resolveSettingsFile, updateNotionOnError, validateEnvironment } from '../helper/executor';

/**
 * 작업 실행 오케스트레이터
 * 3단계 분리: Phase 1 (Notion 조회) → Phase 2 (코드 작업) → Phase 3 (Notion 업데이트)
 */
export async function executeJob (jobName: string): Promise<unknown> {
  const logger = new Logger(jobName);
  await logger.init();

  await logger.info('==========================================');
  await logger.info(`작업 실행 시작: ${jobName}`);
  await logger.info('==========================================');

  // 1. Load config and job
  const config = await loadConfig();
  if (!config) {
    throw new Error('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.');
  }

  const job = await getJob(jobName);
  if (!job) {
    throw new Error(`작업 "${jobName}"을(를) 찾을 수 없습니다.`);
  }

  if (job.status === 'paused') {
    await logger.info(`작업 "${jobName}"은(는) 일시 중지 상태입니다. 건너뜁니다.`);
    return { skipped: true, reason: 'paused' };
  }

  const workDir = job.working_dir.replace(/^~/, process.env.HOME || '~');

  // 2. Validate environment
  await validateEnvironment(workDir, logger);

  // 3. Acquire lock
  await acquireLock(jobName);
  await logger.info('PID 잠금 획득');

  // Resolve settings file
  const settingsFile = resolveSettingsFile();

  // Select agent runner once (instead of repeating 3 times)
  const runAgent = job.agent === 'cursor' ? runCursor : runClaude;

  try {
    // ========================================
    // Phase 1: Notion 조회 (model: sonnet, timeout: 5m)
    // ========================================
    await logger.info('--- Phase 1: Notion 조회 시작 ---');
    const initPrompt = generateInitialPrompt({
      notionDbUrl: config.notion.database_url,
      columns: config.notion,
    });
    console.log(chalk.gray('--------------------------------'));
    console.log(chalk.gray('[Phase 1] 프롬프트:'));
    console.log(chalk.gray(initPrompt));
    console.log(chalk.gray('--------------------------------'));

    const initResult = await runAgent<TaskInfo>({
      prompt: initPrompt,
      workDir,
      settingsFile,
      timeout: '5m',
      logger,
      model: job.model || 'sonnet',
    });

    // SECURITY: Remove rawOutput from logging
    const { rawOutput: _, ...logSafeInit } = initResult;
    await logger.info(`Phase 1 완료: ${JSON.stringify(logSafeInit)}`);

    // Phase 1 JSON 파싱 실패 체크
    if (!initResult.result) {
      throw new Error(`Phase 1 결과 파싱 실패`);
    }

    // 작업 대기 항목 없으면 조기 종료
    if ('no_tasks' in initResult && initResult.no_tasks) {
      await logger.info('작업 대기 항목 없음 — 조기 종료');
      await updateJob(jobName, {
        last_run: new Date().toISOString(),
        last_status: null,
      });
      return initResult;
    }

    const taskInfo = initResult.result;

    // ========================================
    // Phase 2: 코드 작업 + Git Push (model: 기본값, timeout: job.timeout)
    // ========================================
    await logger.info('--- Phase 2: 코드 작업 시작 ---');
    const workPrompt = generateWorkPrompt({
      workDir,
      taskInfo,
    });
    console.log(chalk.gray('--------------------------------'));
    console.log(chalk.gray('[Phase 2] 프롬프트:'));
    console.log(chalk.gray(workPrompt));
    console.log(chalk.gray('--------------------------------'));

    let workResult: WorkResult;
    try {
      const workRunnerResult = await runAgent<WorkResult>({
        prompt: workPrompt,
        workDir,
        settingsFile,
        timeout: String(job.timeout || '30m'),
        logger,
        model: job.model,
      });

      // SECURITY: Remove rawOutput from logging
      const { rawOutput: __, ...logSafeWork } = workRunnerResult;
      await logger.info(`Phase 2 완료: ${JSON.stringify(logSafeWork)}`);

      // Phase 2 JSON 파싱 실패 체크
      if (!workRunnerResult.result) {
        workResult = { success: false, error: `Phase 2 결과 파싱 실패` };
      } else {
        workResult = workRunnerResult.result;
      }
    } catch (err) {
      const error = err as Error;
      await logger.error(`Phase 2 실패: ${error.message}`);
      workResult = { success: false, error: error.message };
    }

    // Phase 2 실패 시 Notion 직접 업데이트
    if (workResult.success === false || workResult.error) {
      await logger.info('--- Phase 2 실패로 인한 Notion 직접 업데이트 ---');
      await updateNotionOnError({ taskInfo, workDir, workResult, config, settingsFile, logger });
    }

    // ========================================
    // Phase 3: Notion 업데이트 (model: sonnet, timeout: 5m)
    // ========================================
    await logger.info('--- Phase 3: Notion 업데이트 시작 ---');
    const finishPrompt = generateFinishPrompt({
      notionDbUrl: config.notion.database_url,
      taskInfo,
      workResult,
      columns: config.notion,
    });
    console.log(chalk.gray('--------------------------------'));
    console.log(chalk.gray('[Phase 3] 프롬프트:'));
    console.log(chalk.gray(finishPrompt));
    console.log(chalk.gray('--------------------------------'));

    const result = await runAgent({
      prompt: finishPrompt,
      workDir,
      settingsFile,
      timeout: '5m',
      logger,
      model: job.model || 'sonnet',
    });

    // SECURITY: Remove rawOutput from logging
    const { rawOutput: ___, ...logSafeFinish } = result;
    await logger.info(`Phase 3 완료: ${JSON.stringify(logSafeFinish)}`);

    // 7. Update job metadata
    await updateJob(jobName, {
      last_run: new Date().toISOString(),
      last_status: workResult.success === false ? 'error' : 'success',
    });

    await logger.info('작업 완료');
    await logger.info('==========================================');

    return result;
  } catch (err) {
    const error = err as Error;
    await logger.error(`작업 실패: ${error.message}`);

    await updateJob(jobName, {
      last_run: new Date().toISOString(),
      last_status: 'error',
    });

    throw err;
  } finally {
    // 8. Release lock
    await releaseLock(jobName);
    await logger.info('PID 잠금 해제');
  }
}
