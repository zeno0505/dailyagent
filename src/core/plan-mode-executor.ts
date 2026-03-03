/**
 * 작업 모드 "계획" 전담 실행 모듈
 *
 * Notion 작업의 work_mode가 "계획"일 때 실행:
 * 1. AI 프롬프트로 작업 디렉토리 분석 및 세부 작업 배열 생성
 * 2. 생성된 배열을 Notion 하위 페이지(후속 작업)로 생성
 */

import { TaskInfo, WorkModePlanResult } from '../types/core.js';
import { Workspace } from '../types/config.js';
import { Logger } from '../logger.js';
import { generateWorkModePlanPrompt } from './prompt-generator.js';
import { createNotionSubPages } from '../notion-api.js';
import { runClaude, runCursor } from './cli-runner.js';
import chalk from 'chalk';

export interface PlanModeResult {
  success: boolean;
  created_page_ids: string[];
  task_count: number;
  error?: string;
}

/**
 * 계획 모드 실행
 * AI가 세부 작업 배열을 생성하고 Notion 하위 페이지로 저장합니다.
 */
export async function executePlanMode(
  runAgent: typeof runClaude | typeof runCursor,
  {
    workDir,
    taskInfo,
    settingsFile,
    job,
    workspace,
    logger,
  }: {
    workDir: string;
    taskInfo: TaskInfo;
    settingsFile: string | undefined;
    job: { timeout?: string; model?: string };
    workspace: Workspace;
    logger: Logger;
  }
): Promise<PlanModeResult> {
  await logger.info('--- 계획 모드: 세부 작업 생성 시작 ---');

  const planPrompt = generateWorkModePlanPrompt({ workDir, taskInfo });

  console.log(chalk.gray('--------------------------------'));
  console.log(chalk.gray('[계획 모드] 프롬프트:'));
  console.log(chalk.gray(planPrompt));
  console.log(chalk.gray('--------------------------------'));

  try {
    const planRunnerResult = await runAgent<WorkModePlanResult>({
      prompt: planPrompt,
      workDir,
      settingsFile,
      timeout: job.timeout || '15m',
      logger,
      model: job.model,
    });

    const { rawOutput: _, ...logSafe } = planRunnerResult;
    await logger.info(`계획 모드 AI 실행 완료: ${JSON.stringify(logSafe)}`);

    if (!planRunnerResult.result) {
      const errorMsg = `계획 모드 결과 파싱 실패 (exitCode: ${planRunnerResult.exitCode})\n${planRunnerResult.rawOutput?.substring(0, 500) || '출력 없음'}`;
      await logger.error(errorMsg);
      return { success: false, created_page_ids: [], task_count: 0, error: errorMsg };
    }

    const { tasks } = planRunnerResult.result;
    if (!Array.isArray(tasks) || tasks.length === 0) {
      const errorMsg = '계획 모드: 생성된 작업 배열이 비어있습니다.';
      await logger.warn(errorMsg);
      return { success: false, created_page_ids: [], task_count: 0, error: errorMsg };
    }

    await logger.info(`계획 모드: ${tasks.length}개의 세부 작업 생성됨`);

    const apiToken = workspace.notion.api_token;
    if (!apiToken) {
      throw new Error('Notion API 토큰이 설정되지 않았습니다.');
    }
    const databaseId = workspace.notion.database_id;
    if (!databaseId) {
      throw new Error('Notion 데이터베이스 ID가 설정되지 않았습니다.');
    }
    if (!taskInfo.task_id) {
      throw new Error('원본 작업의 task_id가 없습니다.');
    }

    const createdPageIds = await createNotionSubPages(
      apiToken,
      databaseId,
      taskInfo.task_id,
      taskInfo.base_branch || '',
      tasks,
      workspace.notion
    );

    await logger.info(`계획 모드: Notion 하위 페이지 ${createdPageIds.length}개 생성 완료`);

    return {
      success: true,
      created_page_ids: createdPageIds,
      task_count: tasks.length,
    };
  } catch (err) {
    const error = err as Error;
    await logger.error(`계획 모드 실패: ${error.message}`);
    return { success: false, created_page_ids: [], task_count: 0, error: error.message };
  }
}
