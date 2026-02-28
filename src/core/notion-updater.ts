/**
 * Phase 3 Notion 업데이트 전담 모듈
 *
 * executor.ts의 Phase 3 로직을 분리하여 유지보수성을 높입니다.
 * - 재검토 모드와 일반 모드의 공통 result 빌더 제공
 * - notion_updated 플래그를 항상 true로 통일 (실제 업데이트가 이루어졌을 때)
 * - SDK 경로(use_api=true)와 MCP 경로(use_api=false) 분기 처리
 */

import { TaskInfo, WorkResult, FinishResult, RunnerOptions } from '../types/core.js';
import { NotionConfig, Workspace } from '../types/config.js';
import { DEFAULT_WORKSPACE_NOTION_CONFIG } from '../config.js';
import { incrementReviewCount, updateNotionPage } from '../notion-api.js';
import { generateFinishPrompt } from './prompt-generator.js';
import { Logger } from '../logger.js';

type RunAgentFn = (options: RunnerOptions) => Promise<unknown>;

/**
 * Phase 3에서 반환할 공통 result 객체를 생성합니다.
 *
 * - notion_updated: 실제 Notion 업데이트 여부 (항상 명시적으로 전달)
 * - 실패 시 branch_name, commits 등은 빈 값으로 통일
 */
export function buildNotionResult(
  taskInfo: TaskInfo,
  workResult: WorkResult,
  notionUpdated: boolean
): FinishResult {
  const isSuccess = workResult.success !== false && !workResult.error;
  return {
    success: isSuccess,
    task_id: taskInfo.task_id || '',
    task_title: taskInfo.task_title || '',
    branch_name: isSuccess ? (workResult.branch_name || '') : '',
    commits: isSuccess ? (workResult.commits || []) : [],
    files_changed: isSuccess ? (workResult.files_changed || []) : [],
    pr_url: isSuccess ? (workResult.pr_url || '') : '',
    pr_skipped_reason: isSuccess ? (workResult.pr_skipped_reason || '') : '',
    summary: isSuccess ? (workResult.summary || '') : (workResult.error || ''),
    notion_updated: notionUpdated,
  };
}

/**
 * 재검토 모드 Notion 업데이트 (SDK 경로)
 *
 * - 검토 횟수를 1 증가시킵니다.
 * - 성공 시: 상태는 유지하고 재검토 완료 내용을 페이지에 추가합니다.
 * - 실패 시: 상태를 '작업 실패'로 변경하고 실패 내용을 추가합니다.
 */
export async function updateNotionForReview(
  apiToken: string,
  taskInfo: TaskInfo,
  workResult: WorkResult,
  notionConfig: NotionConfig,
  logger: Logger
): Promise<FinishResult> {
  if (!taskInfo.task_id) {
    throw new Error('task_id가 없습니다. Notion 업데이트를 수행할 수 없습니다.');
  }
  const taskId = taskInfo.task_id;
  const isSuccess = workResult.success !== false && !workResult.error;
  const columnReviewCount =
    notionConfig.column_review_count || DEFAULT_WORKSPACE_NOTION_CONFIG.column_review_count;
  const currentReviewCount = taskInfo.review_count ?? 0;

  const reviewProperties: Record<string, unknown> = {};
  if (!isSuccess) {
    const statusColumn = notionConfig.column_status || '상태';
    reviewProperties[statusColumn] = {
      status: { name: notionConfig.column_status_error || '작업 실패' },
    };
  }

  const reviewContent = isSuccess
    ? `\n---\n\n## ${currentReviewCount + 1}차 자동 재검토 완료\n\n검토 시간: ${new Date().toISOString()}\n\n커밋 해시: ${workResult.commits?.[0]?.hash || '변경 없음'}\n\n검토 결과 요약:\n${workResult.summary || ''}\n`
    : `\n---\n\n## ${currentReviewCount + 1}차 자동 재검토 실패\n\n실패 시간: ${new Date().toISOString()}\n\n에러 내용:\n${workResult.error || 'Unknown error'}\n`;

  await incrementReviewCount(
    apiToken,
    taskId,
    columnReviewCount,
    currentReviewCount
  );
  await updateNotionPage(apiToken, taskId, reviewProperties, reviewContent);

  await logger.info(`재검토 모드 Phase 3 완료: 검토 횟수 ${currentReviewCount + 1}`);
  return buildNotionResult(taskInfo, workResult, true);
}

/**
 * 일반 모드 Notion 업데이트 (SDK 경로)
 *
 * - 성공 시: 상태를 '검토 전'으로 변경하고 작업 브랜치 컬럼을 업데이트합니다.
 * - 실패 시: 상태를 '작업 실패'로 변경합니다.
 */
export async function updateNotionForNormal(
  apiToken: string,
  taskInfo: TaskInfo,
  workResult: WorkResult,
  notionConfig: NotionConfig,
  logger: Logger
): Promise<FinishResult> {
  if (!taskInfo.task_id) {
    throw new Error('task_id가 없습니다. Notion 업데이트를 수행할 수 없습니다.');
  }
  const taskId = taskInfo.task_id;
  const isSuccess = workResult.success !== false && !workResult.error;
  const statusColumn = notionConfig.column_status || '상태';
  const workBranchColumn = notionConfig.column_work_branch || '작업 브랜치';
  const statusValue = isSuccess
    ? notionConfig.column_status_review || '검토 전'
    : notionConfig.column_status_error || '작업 실패';

  const properties: Record<string, unknown> = {
    [statusColumn]: {
      status: { name: statusValue },
    },
  };

  if (isSuccess && workResult.branch_name) {
    properties[workBranchColumn] = {
      rich_text: [
        {
          type: 'text',
          text: { content: workResult.branch_name },
        },
      ],
    };
  }

  const content = isSuccess
    ? `\n---\n\n## 자동화 작업 완료\n\n완료 시간: ${new Date().toISOString()}\n\n커밋 해시: ${workResult.commits?.[0]?.hash || ''}\n\nPR: ${workResult.pr_url || workResult.pr_skipped_reason || 'PR 정보 없음'}\n\n수행 작업 요약:\n${workResult.summary || ''}\n`
    : `\n---\n\n## 자동화 작업 실패\n\n실패 시간: ${new Date().toISOString()}\n\n에러 내용:\n${workResult.error || 'Unknown error'}\n`;

  await updateNotionPage(apiToken, taskId, properties, content);

  await logger.info('일반 모드 Phase 3 완료');
  return buildNotionResult(taskInfo, workResult, true);
}

/**
 * MCP 경로 Notion 업데이트
 *
 * generateFinishPrompt를 통해 LLM이 Notion MCP 도구를 호출하도록 합니다.
 */
export async function updateNotionViaMcp(
  runAgent: RunAgentFn,
  taskInfo: TaskInfo,
  workResult: WorkResult,
  workspace: Workspace,
  workDir: string,
  settingsFile: string | undefined,
  logger: Logger
): Promise<unknown> {
  const databaseUrl = workspace.notion.database_url;
  if (!databaseUrl) {
    throw new Error('Notion 데이터베이스 URL이 설정되지 않았습니다.');
  }

  const finishPrompt = generateFinishPrompt({
    databaseUrl,
    taskInfo,
    workResult,
    columns: workspace.notion,
  });

  await logger.info('MCP를 사용하여 Notion 업데이트');
  return runAgent({
    prompt: finishPrompt,
    workDir,
    settingsFile,
    timeout: '5m',
    logger,
    model: 'sonnet',
  });
}

/**
 * Phase 3 통합 진입점
 *
 * Notion 업데이트 방식(SDK/MCP)과 실행 모드(재검토/일반)를 판별하여
 * 적절한 업데이트 함수로 위임합니다.
 */
export async function executePhase3(
  runAgent: RunAgentFn,
  taskInfo: TaskInfo,
  workResult: WorkResult,
  workspace: Workspace,
  workDir: string,
  settingsFile: string | undefined,
  logger: Logger
): Promise<unknown> {
  const { api_token, use_api } = workspace.notion;

  if (use_api && api_token) {
    if (taskInfo.is_review) {
      return updateNotionForReview(api_token, taskInfo, workResult, workspace.notion, logger);
    } else {
      return updateNotionForNormal(api_token, taskInfo, workResult, workspace.notion, logger);
    }
  } else {
    return updateNotionViaMcp(
      runAgent,
      taskInfo,
      workResult,
      workspace,
      workDir,
      settingsFile,
      logger
    );
  }
}
