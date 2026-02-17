import path from 'path';
import fs from 'fs-extra';
import { loadConfig, PROMPTS_DIR } from '../config';
import { getJob, updateJob, acquireLock, releaseLock } from '../jobs';
import { Logger } from '../logger';
import { generateInitialPrompt, generateWorkPrompt, generateFinishPrompt, generatePlanPrompt, generateImplementPrompt, generateReviewPrompt } from './prompt-generator';
import chalk from 'chalk';
import { TaskInfo, WorkResult, PlanResult, ImplResult } from '../types/core';
import { fetchPendingTask, updateNotionPage } from '../notion-api';
import { runClaude, runCursor } from './cli-runner';
import { resolveSettingsFile, validateEnvironment } from '../utils/executor';
import { sendSlackNotification } from '../slack/webhook';

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
    
    let taskInfo: TaskInfo | null = null;

    // Notion API 사용 여부에 따라 분기
    if (config.notion.use_api && config.notion.api_token) {
      // Notion API 직접 호출
      await logger.info('Notion API를 사용하여 작업 조회');
      console.log(chalk.gray('--------------------------------'));
      console.log(chalk.gray('[Phase 1] Notion API 직접 호출'));
      console.log(chalk.gray('--------------------------------'));

      const apiToken = config.notion.api_token;
      if (!apiToken) {
        throw new Error('Notion API 토큰이 설정되지 않았습니다.');
      }
      const datasourceId = config.notion.datasource_id;
      if (!datasourceId) {
        throw new Error('Notion 데이터소스 ID가 설정되지 않았습니다.');
      }

      taskInfo = await fetchPendingTask(
        apiToken,
        datasourceId,
        config.notion
      );

      if (!taskInfo) {
        await logger.info('작업 대기 항목 없음 — 조기 종료');
        await updateJob(jobName, {
          last_run: new Date().toISOString(),
          last_status: null,
        });
        return { no_tasks: true };
      }

      await logger.info(`Phase 1 완료: ${JSON.stringify(taskInfo)}`);
    } else {
      // MCP 사용 (기존 방식)
      await logger.info('MCP를 사용하여 작업 조회');


      const databaseUrl = config.notion.database_url;
      if (!databaseUrl) {
        throw new Error('Notion 데이터베이스 URL이 설정되지 않았습니다.');
      }

      const initPrompt = generateInitialPrompt({
        databaseUrl: databaseUrl,
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
    }

    // taskInfo null 체크
    if (!taskInfo) {
      throw new Error('작업 정보를 가져올 수 없습니다.');
    }

    // ========================================
    // Phase 2: 코드 작업 + Git Push
    // ========================================
    const phase2Mode = job.execution?.phase2_mode || 'single';
    await logger.info(`--- Phase 2: 코드 작업 시작 (mode: ${phase2Mode}) ---`);

    let workResult: WorkResult;

    if (phase2Mode === 'session' && job.prompt_mode !== 'custom') {
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
          throw new Error(`Phase 2-1 결과 파싱 실패`);
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
          throw new Error(`Phase 2-2 결과 파싱 실패`);
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
          workResult = { success: false, error: `Phase 2-3 결과 파싱 실패` };
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
    // Phase 3: Notion 업데이트 (model: sonnet, timeout: 5m)
    // ========================================
    await logger.info('--- Phase 3: Notion 업데이트 시작 ---');
    
    let result: unknown;

    // Notion API 사용 여부에 따라 분기
    if (config.notion.use_api && config.notion.api_token) {
      // Notion API 직접 호출
      await logger.info('Notion API를 사용하여 업데이트');
      console.log(chalk.gray('--------------------------------'));
      console.log(chalk.gray('[Phase 3] Notion API 직접 호출'));
      console.log(chalk.gray('--------------------------------'));

      const isSuccess = workResult.success !== false && !workResult.error;
      const statusColumn = config.notion.column_status || '상태';
      const workBranchColumn = config.notion.column_work_branch || '작업 브랜치';
      const statusValue = isSuccess
        ? config.notion.column_status_review || '검토 전'
        : config.notion.column_status_error || '작업 실패';

      const properties: Record<string, unknown> = {
        [statusColumn]: {
          status: {
            name: statusValue,
          },
        },
      };

      if (isSuccess && workResult.branch_name) {
        properties[workBranchColumn] = {
          rich_text: [
            {
              type: 'text',
              text: {
                content: workResult.branch_name,
              },
            },
          ],
        };
      }

      const content = isSuccess
        ? `\n---\n\n## 자동화 작업 완료\n\n완료 시간: ${new Date().toISOString()}\n\n커밋 해시: ${workResult.commits?.[0]?.hash || ''}\n\nPR: ${workResult.pr_url || workResult.pr_skipped_reason || 'PR 정보 없음'}\n\n수행 작업 요약:\n${workResult.summary || ''}\n`
        : `\n---\n\n## 자동화 작업 실패\n\n실패 시간: ${new Date().toISOString()}\n\n에러 내용:\n${workResult.error || 'Unknown error'}\n`;

      if (!config.notion.api_token) {
        throw new Error('Notion API 토큰이 설정되지 않았습니다.');
      }

      await updateNotionPage(
        config.notion.api_token!,
        taskInfo.task_id!,
        properties,
        content
      );

      result = {
        success: isSuccess,
        task_id: taskInfo.task_id,
        task_title: taskInfo.task_title,
        branch_name: isSuccess ? workResult.branch_name : '',
        commits: isSuccess ? workResult.commits : [],
        files_changed: isSuccess ? workResult.files_changed : [],
        pr_url: isSuccess ? workResult.pr_url : '',
        pr_skipped_reason: isSuccess ? workResult.pr_skipped_reason : '',
        summary: isSuccess ? workResult.summary : workResult.error,
        notion_updated: true,
      };

      await logger.info(`Phase 3 완료: ${JSON.stringify(result)}`);
    } else {
      // MCP 사용 (기존 방식)
      await logger.info('MCP를 사용하여 업데이트');
      const databaseUrl = config.notion.database_url;
      if (!databaseUrl) {
        throw new Error('Notion 데이터베이스 URL이 설정되지 않았습니다.');
      }
      const finishPrompt = generateFinishPrompt({
        databaseUrl: databaseUrl,
        taskInfo,
        workResult,
        columns: config.notion,
      });
      console.log(chalk.gray('--------------------------------'));
      console.log(chalk.gray('[Phase 3] 프롬프트:'));
      console.log(chalk.gray(finishPrompt));
      console.log(chalk.gray('--------------------------------'));

      result = await runAgent({
        prompt: finishPrompt,
        workDir,
        settingsFile,
        timeout: '5m',
        logger,
        model: 'sonnet',
      });
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
      .replace(/\{\{workDir\}\}/g, workDir)
      .replace(/\{\{taskInfo\}\}/g, JSON.stringify(taskInfo, null, 2));
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
      return { success: false, error: `Phase 2 결과 파싱 실패` };
    }
    return workRunnerResult.result;
  } catch (err) {
    const error = err as Error;
    await logger.error(`Phase 2 실패: ${error.message}`);
    return { success: false, error: error.message };
  }
}


class NoSessionIdError extends Error {}