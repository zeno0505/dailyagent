import path from 'path';
import fs from 'fs-extra';
import { loadConfig, PROMPTS_DIR, DEFAULT_WORKSPACE_NOTION_CONFIG } from '../config.js';
import { getJob, updateJob, acquireLock, releaseLock } from '../jobs.js';
import { getWorkspace } from '../workspace.js';
import { Logger } from '../logger.js';
import { generateInitialPrompt, generateWorkPrompt, generatePlanPrompt, generateImplementPrompt, generateReviewPrompt, generateReviewTaskPrompt } from './prompt-generator.js';
import { executePhase3 } from './notion-updater.js';
import chalk from 'chalk';
import { TaskInfo, WorkResult, PlanResult, ImplResult } from '../types/core.js';
import { fetchPendingTask, fetchReviewTask } from '../notion-api.js';
import { runClaude, runCursor } from './cli-runner.js';
import { resolveSettingsFile, validateEnvironment } from '../utils/executor.js';
import { sendSlackNotification } from '../slack/webhook.js';

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

  // Load workspace configuration
  const workspaceName = job.workspace || config.active_workspace || 'default';
  const workspace = await getWorkspace(workspaceName);
  if (!workspace) {
    throw new Error(`Workspace "${workspaceName}"을(를) 찾을 수 없습니다.`);
  }

  const workDir = workspace.working_dir.replace(/^~/, process.env.HOME || '~');

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
    // 커스텀 모드 처리: Phase 1, 3 스킵
    // ========================================
    const isCustomMode = job.prompt_mode === 'custom';

    let taskInfo: TaskInfo | null = null;

    if (isCustomMode) {
      await logger.info('커스텀 모드: Phase 1 (Notion 조회) 스킵');
      // 커스텀 모드에서는 최소한의 taskInfo만 생성
      taskInfo = {
        task_id: jobName,
        task_title: `Custom Job: ${jobName}`,
      };
    }
    // Notion API 사용 여부에 따라 분기
    else if (workspace.notion.use_api && workspace.notion.api_token) {
      // Notion SDK 사용
      await logger.info('Notion SDK를 사용하여 작업 조회');
      console.log(chalk.gray('--------------------------------'));
      console.log(chalk.gray('[Phase 1] Notion SDK 호출'));
      console.log(chalk.gray('--------------------------------'));

      const apiToken = workspace.notion.api_token;

      // database_id 우선, 없으면 datasource_id 사용 (하위 호환성)
      const databaseId = workspace.notion.database_id || workspace.notion.datasource_id;
      if (!databaseId) {
        throw new Error('Notion 데이터베이스 ID가 설정되지 않았습니다.');
      }

      taskInfo = await fetchPendingTask(
        apiToken,
        databaseId,
        workspace.notion
      );

      if (!taskInfo) {
        const maxReviewCount = workspace.notion.max_review_count ?? DEFAULT_WORKSPACE_NOTION_CONFIG.max_review_count;
        if (maxReviewCount > 0) {
          await logger.info(`작업 대기 항목 없음 — 검토 전 항목 확인 (최대 ${maxReviewCount}회)`);
          taskInfo = await fetchReviewTask(apiToken, databaseId, workspace.notion, maxReviewCount);
        }

        if (!taskInfo) {
          await logger.info('작업 대기 항목 없음 — 조기 종료');
          await updateJob(jobName, {
            last_run: new Date().toISOString(),
            last_status: null,
          });
          return { no_tasks: true };
        }

        await logger.info(`검토 전 항목 선택: task_id=${taskInfo.task_id}, review_count=${taskInfo.review_count}`);
      }

      const { page_url: _pageUrl, ...logSafeTaskInfo } = taskInfo;
      await logger.info(`Phase 1 완료: ${JSON.stringify(logSafeTaskInfo)}`);
    } else {
      // ========================================
      // Phase 1: Notion 조회 (model: sonnet, timeout: 5m)
      // ========================================
      await logger.info('--- Phase 1: Notion 조회 시작 ---');

      // MCP 사용 (기존 방식)
      await logger.info('MCP를 사용하여 작업 조회');

      const databaseUrl = workspace.notion.database_url;
      if (!databaseUrl) {
        throw new Error('Notion 데이터베이스 URL이 설정되지 않았습니다.');
      }

      const initPrompt = generateInitialPrompt({
        databaseUrl: databaseUrl,
        columns: workspace.notion,
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
        model: 'sonnet',
      });
      await logger.info(`Phase 1 완료: ${JSON.stringify(initResult)}`);

      // Phase 1 JSON 파싱 실패 체크
      if (!initResult.result) {
        throw new Error(`Phase 1 결과 파싱 실패: ${initResult.rawOutput}`);
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

      taskInfo = initResult.result;

      // taskInfo null 체크
      if (!taskInfo) {
        throw new Error('작업 정보를 가져올 수 없습니다.');
      }
    }

    // ========================================
    // Phase 2: 코드 작업 + Git Push
    // ========================================
    const phase2Mode = job.execution?.phase2_mode || 'single';
    await logger.info(`--- Phase 2: 코드 작업 시작 (mode: ${taskInfo.is_review ? 'review' : phase2Mode}) ---`);

    let workResult: WorkResult;

    if (taskInfo.is_review) {
      // ========================================
      // Review Mode: 재검토
      // ========================================
      await logger.info('--- Phase 2: 재검토 모드 ---');
      workResult = await executeReviewPhase(runAgent, { workDir, taskInfo, settingsFile, job, logger });
    } else if (phase2Mode === 'session' && job.prompt_mode !== 'custom') {
      // ========================================
      // Session Mode: Phase 2-1 → 2-2 → 2-3
      // ========================================
      try {
        const planModel = job.execution?.phase2_plan_model;
        const implModel = job.execution?.phase2_impl_model;
        const reviewModel = job.execution?.phase2_review_model;
        const planTimeout = job.execution?.phase2_plan_timeout;
        const reviewTimeout = job.execution?.phase2_review_timeout;

        // Phase 2-1: 개발 계획 작성
        await logger.info('--- Phase 2-1: 개발 계획 작성 ---');
        const planPrompt = generatePlanPrompt({ workDir, taskInfo });
        console.log(chalk.gray('--------------------------------'));
        console.log(chalk.gray('[Phase 2-1] 프롬프트:'));
        console.log(chalk.gray(planPrompt));
        console.log(chalk.gray('--------------------------------'));

        const planRunnerResult = await runAgent<PlanResult>({
          prompt: planPrompt,
          workDir,
          settingsFile,
          timeout: planTimeout,
          logger,
          model: planModel,
          enableSessionPersistence: true,
        });

        const { rawOutput: _p, ...logSafePlan } = planRunnerResult;
        await logger.info(`Phase 2-1 완료: ${JSON.stringify(logSafePlan)}`);

        if (!planRunnerResult.result) {
          const errorMsg = `Phase 2-1 결과 파싱 실패 (exitCode: ${planRunnerResult.exitCode})\n${planRunnerResult.rawOutput?.substring(0, 500) || '출력 없음'}`;
          throw new Error(errorMsg);
        }

        const sessionId = planRunnerResult.sessionId;
        if (!sessionId) {
          await logger.warn('세션 ID를 가져올 수 없습니다. 단일 모드로 폴백합니다.');
          throw new NoSessionIdError();
        }
        await logger.info(`Phase 2-1 세션 ID 획득: ${sessionId}`);

        // Phase 2-2: 실제 구현
        await logger.info('--- Phase 2-2: 실제 구현 ---');
        const implPrompt = generateImplementPrompt({ planResult: planRunnerResult.result });
        console.log(chalk.gray('--------------------------------'));
        console.log(chalk.gray('[Phase 2-2] 프롬프트:'));
        console.log(chalk.gray(implPrompt));
        console.log(chalk.gray('--------------------------------'));

        const implRunnerResult = await runAgent<ImplResult>({
          prompt: implPrompt,
          workDir,
          settingsFile,
          timeout: String(job.timeout || '30m'),
          logger,
          model: implModel,
          sessionId: sessionId,
          enableSessionPersistence: true,
        });

        const { rawOutput: _i, ...logSafeImpl } = implRunnerResult;
        await logger.info(`Phase 2-2 완료: ${JSON.stringify(logSafeImpl)}`);

        if (!implRunnerResult.result) {
          const errorMsg = `Phase 2-2 결과 파싱 실패 (exitCode: ${implRunnerResult.exitCode})\n${implRunnerResult.rawOutput?.substring(0, 500) || '출력 없음'}`;
          throw new Error(errorMsg);
        }

        await logger.info(`Phase 2-2 세션 ID 유지: ${sessionId}`);

        // Phase 2-3: 구현 결과 검토
        await logger.info('--- Phase 2-3: 구현 결과 검토 ---');
        const reviewPrompt = generateReviewPrompt({ taskInfo });
        console.log(chalk.gray('--------------------------------'));
        console.log(chalk.gray('[Phase 2-3] 프롬프트:'));
        console.log(chalk.gray(reviewPrompt));
        console.log(chalk.gray('--------------------------------'));

        const reviewRunnerResult = await runAgent<WorkResult>({
          prompt: reviewPrompt,
          workDir,
          settingsFile,
          timeout: reviewTimeout,
          logger,
          model: reviewModel,
          sessionId: sessionId,
          enableSessionPersistence: true,
        });

        const { rawOutput: _r, ...logSafeReview } = reviewRunnerResult;
        await logger.info(`Phase 2-3 완료: ${JSON.stringify(logSafeReview)}`);

        if (!reviewRunnerResult.result) {
          const errorMsg = `Phase 2-3 결과 파싱 실패 (exitCode: ${reviewRunnerResult.exitCode})\n${reviewRunnerResult.rawOutput?.substring(0, 500) || '출력 없음'}`;
          workResult = { success: false, error: errorMsg };
        } else {
          workResult = reviewRunnerResult.result;
        }
      } catch (err) {
        const error = err as Error;
        if (error instanceof NoSessionIdError) {
          // Fallback to single mode
          await logger.info('단일 모드로 폴백하여 Phase 2 재실행');
          workResult = await executePhase2Single(runAgent, { workDir, taskInfo, settingsFile, job, jobName, logger });
        } else {
          await logger.error(`Phase 2 (session) 실패: ${error.message}`);
          workResult = { success: false, error: error.message };
        }
      }
    } else {
      // ========================================
      // Single Mode: 기존 방식 (Phase 2 단일 실행)
      // ========================================
      workResult = await executePhase2Single(runAgent, { workDir, taskInfo, settingsFile, job, jobName, logger });
    }

    // ========================================
    // Phase 3: Notion 업데이트
    // ========================================
    let result: unknown;

    if (isCustomMode) {
      await logger.info('커스텀 모드: Phase 3 (Notion 업데이트) 스킵');
    } else {
      await logger.info('--- Phase 3: Notion 업데이트 시작 ---');
      result = await executePhase3(runAgent, taskInfo, workResult, workspace, workDir, settingsFile, logger);
      await logger.info(`Phase 3 완료: ${JSON.stringify(result)}`);
    }

    // 7. Update job metadata
    await updateJob(jobName, {
      last_run: new Date().toISOString(),
      last_status: workResult.success === false ? 'error' : 'success',
    });

    // ========================================
    // Phase 4: Slack 알림 발송 (선택사항)
    // ========================================
    if (config.slack?.enabled && config.slack?.webhook_url) {
      await logger.info('--- Phase 4: Slack 알림 발송 ---');
      await sendSlackNotification({
        taskInfo,
        workResult,
        webhookUrl: config.slack.webhook_url,
        logger,
      });
    }

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

/**
 * Phase 2 단일 실행 (기존 방식)
 */
async function executePhase2Single(
  runAgent: typeof runClaude,
  { workDir, taskInfo, settingsFile, job, jobName, logger }: {
    workDir: string;
    taskInfo: TaskInfo;
    settingsFile: string | undefined;
    job: { timeout?: string; model?: string; prompt_mode?: string };
    jobName: string;
    logger: Logger;
  }
): Promise<WorkResult> {
  let workPrompt: string;
  if (job.prompt_mode === 'custom') {
    const promptFile = path.join(PROMPTS_DIR, `${jobName}.md`);
    if (!(await fs.pathExists(promptFile))) {
      throw new Error(`커스텀 프롬프트 파일이 존재하지 않습니다: ${promptFile}`);
    }
    const template = await fs.readFile(promptFile, 'utf8');
    workPrompt = template
      .replace(/\{\{workDir\}\}/g, workDir);
    await logger.info(`커스텀 프롬프트 사용: ${promptFile}`);
  } else {
    workPrompt = generateWorkPrompt({ workDir, taskInfo });
  }

  console.log(chalk.gray('--------------------------------'));
  console.log(chalk.gray('[Phase 2] 프롬프트:'));
  console.log(chalk.gray(workPrompt));
  console.log(chalk.gray('--------------------------------'));

  try {
    const workRunnerResult = await runAgent<WorkResult>({
      prompt: workPrompt,
      workDir,
      settingsFile,
      timeout: String(job.timeout || '30m'),
      logger,
      model: job.model,
    });

    const { rawOutput: __, ...logSafeWork } = workRunnerResult;
    await logger.info(`Phase 2 완료: ${JSON.stringify(logSafeWork)}`);

    if (!workRunnerResult.result) {
      const errorMsg = `Phase 2 결과 파싱 실패 (exitCode: ${workRunnerResult.exitCode})\n${workRunnerResult.rawOutput?.substring(0, 500) || '출력 없음'}`;
      return { success: false, error: errorMsg };
    }
    return workRunnerResult.result;
  } catch (err) {
    const error = err as Error;
    await logger.error(`Phase 2 실패: ${error.message}`);
    return { success: false, error: error.message };
  }
}


/**
 * 재검토 Phase 실행
 * 기존 작업 브랜치를 체크아웃하여 코드 품질 재검토 후 수정·커밋·Push
 */
async function executeReviewPhase(
  runAgent: typeof runClaude,
  { workDir, taskInfo, settingsFile, job, logger }: {
    workDir: string;
    taskInfo: TaskInfo;
    settingsFile: string | undefined;
    job: { timeout?: string; model?: string };
    logger: Logger;
  }
): Promise<WorkResult> {
  const reviewPrompt = generateReviewTaskPrompt({ workDir, taskInfo });

  console.log(chalk.gray('--------------------------------'));
  console.log(chalk.gray('[Phase 2 - Review] 프롬프트:'));
  console.log(chalk.gray(reviewPrompt));
  console.log(chalk.gray('--------------------------------'));

  try {
    const reviewRunnerResult = await runAgent<WorkResult>({
      prompt: reviewPrompt,
      workDir,
      settingsFile,
      timeout: job.timeout || '30m',
      logger,
      model: job.model,
    });

    const { rawOutput: __, ...logSafeReview } = reviewRunnerResult;
    await logger.info(`재검토 완료: ${JSON.stringify(logSafeReview)}`);

    if (!reviewRunnerResult.result) {
      const errorMsg = `재검토 결과 파싱 실패 (exitCode: ${reviewRunnerResult.exitCode})\n${reviewRunnerResult.rawOutput?.substring(0, 500) || '출력 없음'}`;
      return { success: false, error: errorMsg };
    }
    return reviewRunnerResult.result;
  } catch (err) {
    const error = err as Error;
    await logger.error(`재검토 실패: ${error.message}`);
    return { success: false, error: error.message };
  }
}

class NoSessionIdError extends Error {}