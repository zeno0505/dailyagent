import { Logger } from '../logger.js';
import { TaskInfo, WorkResult, PlanModeResult } from '../types/core.js';

export interface SlackNotificationParams {
  taskInfo: TaskInfo;
  workResult: WorkResult;
  botToken: string;
  targetEmail: string;
  logger?: Logger;
}

export interface PlanSlackNotificationParams {
  taskInfo: TaskInfo;
  planResult: PlanModeResult;
  botToken: string;
  targetEmail: string;
  logger?: Logger;
}

// ─── Slack API 응답 타입 ────────────────────────────────────────────────────

interface UsersLookupByEmailResponse {
  ok: boolean;
  user?: { id: string; name?: string };
  error?: string;
}

interface ConversationsOpenResponse {
  ok: boolean;
  channel?: { id: string };
  error?: string;
}

interface ChatPostMessageResponse {
  ok: boolean;
  error?: string;
}

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

/**
 * Slack Web API 호출 공통 헬퍼 — HTTP 및 API 수준 오류를 통합 처리
 */
async function slackApiCall<T extends { ok: boolean; error?: string }>(
  url: string,
  init: { method: string; body?: string },
  botToken: string,
  operationName: string,
): Promise<T> {
  const headers: Record<string, string> = { 'Authorization': `Bearer ${botToken}` };
  if (init.body) headers['Content-Type'] = 'application/json; charset=utf-8';

  const response = await fetch(url, { ...init, headers });
  if (!response.ok) {
    throw new Error(`${operationName} HTTP 오류: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as T;
  if (!data.ok) {
    throw new Error(`${operationName} API 오류: ${data.error ?? '알 수 없는 오류'}`);
  }

  return data;
}

/**
 * 이메일로 Slack User ID 조회 (users.lookupByEmail)
 * 필요 scope: users:read.email
 */
async function lookupUserByEmail(botToken: string, email: string): Promise<string> {
  const url = `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`;
  const data = await slackApiCall<UsersLookupByEmailResponse>(url, { method: 'GET' }, botToken, 'users.lookupByEmail');
  if (!data.user?.id) throw new Error('users.lookupByEmail API 오류: user ID 없음');
  return data.user.id;
}

/**
 * DM 채널 열기 (conversations.open)
 * 필요 scope: im:write
 */
async function openDmChannel(botToken: string, userId: string): Promise<string> {
  const data = await slackApiCall<ConversationsOpenResponse>(
    'https://slack.com/api/conversations.open',
    { method: 'POST', body: JSON.stringify({ users: userId }) },
    botToken, 'conversations.open',
  );
  if (!data.channel?.id) throw new Error('conversations.open API 오류: channel ID 없음');
  return data.channel.id;
}

/**
 * 메시지 발송 (chat.postMessage)
 * 필요 scope: chat:write
 */
async function postMessage(
  botToken: string,
  channelId: string,
  payload: { text: string; blocks: unknown[] }
): Promise<void> {
  await slackApiCall<ChatPostMessageResponse>(
    'https://slack.com/api/chat.postMessage',
    { method: 'POST', body: JSON.stringify({ channel: channelId, ...payload }) },
    botToken, 'chat.postMessage',
  );
}

function buildWorkResultPayload(
  taskInfo: TaskInfo,
  workResult: WorkResult,
  isSuccess: boolean,
  statusEmoji: string,
  statusText: string
): { text: string; blocks: unknown[] } {
  return {
    text: `${statusEmoji} DailyAgent 작업 ${statusText}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${statusEmoji} DailyAgent 작업 ${statusText}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*제목*\n${taskInfo.task_title ?? '제목 없음'}`,
          },
          {
            type: 'mrkdwn',
            text: `*상태*\n${statusText}`,
          },
        ],
      },
      ...(isSuccess
        ? [
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*브랜치*\n\`${workResult.branch_name ?? 'N/A'}\``,
                },
                {
                  type: 'mrkdwn',
                  text: `*커밋*\n\`${workResult.commits[0]?.hash.slice(0, 7) ?? 'N/A'}\``,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*요약*\n${workResult.summary ?? '요약 없음'}`,
              },
            },
          ]
        : [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*에러*\n${workResult.error ?? '알 수 없는 에러'}`,
              },
            },
          ]),
      {
        type: 'actions',
        elements: [
          ...(taskInfo.page_url
            ? [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Notion 페이지' },
                  url: taskInfo.page_url,
                },
              ]
            : []),
          ...(isSuccess && workResult.pr_url
            ? [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'PR 보기' },
                  url: workResult.pr_url,
                },
              ]
            : []),
        ],
      },
    ],
  };
}

function buildPlanResultPayload(
  taskInfo: TaskInfo,
  planResult: PlanModeResult,
  isSuccess: boolean,
  statusEmoji: string,
  statusText: string
): { text: string; blocks: unknown[] } {
  return {
    text: `${statusEmoji} DailyAgent 계획 모드 ${statusText}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${statusEmoji} DailyAgent 계획 모드 ${statusText}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*제목*\n${taskInfo.task_title ?? '제목 없음'}`,
          },
          {
            type: 'mrkdwn',
            text: `*상태*\n${statusText}`,
          },
          {
            type: 'mrkdwn',
            text: `*생성 작업 수*\n${planResult.task_count}`,
          },
          {
            type: 'mrkdwn',
            text: `*생성 페이지 수*\n${planResult.created_page_ids.length}`,
          },
        ],
      },
      ...(!isSuccess
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*에러*\n${planResult.error ?? '알 수 없는 에러'}`,
              },
            },
          ]
        : []),
      {
        type: 'actions',
        elements: [
          ...(taskInfo.page_url
            ? [
                {
                  type: 'button',
                  text: { type: 'plain_text', text: 'Notion 페이지' },
                  url: taskInfo.page_url,
                },
              ]
            : []),
        ],
      },
    ],
  };
}

// ─── Public 함수 ─────────────────────────────────────────────────────────────

/**
 * 이메일 → User ID → DM 채널 → 메시지 순으로 3단계 API 호출하여 DM 발송
 */
async function sendDm(
  botToken: string,
  targetEmail: string,
  payload: { text: string; blocks: unknown[] }
): Promise<void> {
  const userId = await lookupUserByEmail(botToken, targetEmail);
  const channelId = await openDmChannel(botToken, userId);
  await postMessage(botToken, channelId, payload);
}

/**
 * sendDm 호출 공통 래퍼 — 성공/실패 로깅과 boolean 반환 처리
 */
async function trySendDm(
  botToken: string,
  targetEmail: string,
  payload: { text: string; blocks: unknown[] },
  logger: Logger | undefined,
  successMsg: string,
  errorPrefix: string,
): Promise<boolean> {
  try {
    await sendDm(botToken, targetEmail, payload);
    if (logger) await logger.info(successMsg);
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (logger) await logger.error(`${errorPrefix}: ${error}`);
    return false;
  }
}

/**
 * Slack Bot DM으로 작업 완료 알림 발송
 */
export async function sendSlackNotification(
  params: SlackNotificationParams
): Promise<boolean> {
  const { taskInfo, workResult, botToken, targetEmail, logger } = params;
  const isSuccess = workResult.success !== false && !workResult.error;
  const statusEmoji = isSuccess ? '✅' : '❌';
  const statusText = isSuccess ? '완료' : '실패';
  const payload = buildWorkResultPayload(taskInfo, workResult, isSuccess, statusEmoji, statusText);
  return trySendDm(botToken, targetEmail, payload, logger, 'Slack DM 알림 발송 완료', 'Slack DM 알림 발송 중 오류');
}

/**
 * Slack Bot DM으로 계획 모드 알림 발송
 */
export async function sendPlanSlackNotification(
  params: PlanSlackNotificationParams
): Promise<boolean> {
  const { taskInfo, planResult, botToken, targetEmail, logger } = params;
  const isSuccess = planResult.success;
  const statusEmoji = isSuccess ? '✅' : '❌';
  const statusText = isSuccess ? '완료' : '실패';
  const payload = buildPlanResultPayload(taskInfo, planResult, isSuccess, statusEmoji, statusText);
  return trySendDm(botToken, targetEmail, payload, logger, '계획 모드 Slack DM 알림 발송 완료', '계획 모드 Slack DM 알림 발송 중 오류');
}
