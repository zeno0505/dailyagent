import { Logger } from '../logger.js';
import { TaskInfo, WorkResult } from '../types/core.js';

export interface SlackNotificationParams {
  taskInfo: TaskInfo;
  workResult: WorkResult;
  webhookUrl: string;
  logger?: Logger;
}

/**
 * Slack Webhook을 통해 작업 완료 알림 발송
 */
export async function sendSlackNotification(
  params: SlackNotificationParams
): Promise<boolean> {
  const { taskInfo, workResult, webhookUrl, logger } = params;

  if (!webhookUrl) {
    if (logger) {
      await logger.warn('Slack Webhook URL이 설정되지 않았습니다.');
    }
    return false;
  }

  try {
    // Slack 메시지 구성
    const isSuccess = workResult.success !== false && !workResult.error;
    const statusEmoji = isSuccess ? '✅' : '❌';
    const statusText = isSuccess ? '완료' : '실패';

    const message = {
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
              text: `*제목*\n${taskInfo.task_title || '제목 없음'}`,
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
                    text: `*브랜치*\n\`${workResult.branch_name || 'N/A'}\``,
                  },
                  {
                    type: 'mrkdwn',
                    text: `*커밋*\n\`${workResult.commits?.[0]?.hash?.slice(0, 7) || 'N/A'}\``,
                  },
                ],
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*요약*\n${workResult.summary || '요약 없음'}`,
                },
              },
            ]
          : [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*에러*\n${workResult.error || '알 수 없는 에러'}`,
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
                    text: {
                      type: 'plain_text',
                      text: 'Notion 페이지',
                    },
                    url: taskInfo.page_url,
                  },
                ]
              : []),
            ...(isSuccess && workResult.pr_url
              ? [
                  {
                    type: 'button',
                    text: {
                      type: 'plain_text',
                      text: 'PR 보기',
                    },
                    url: workResult.pr_url,
                  },
                ]
              : []),
          ],
        },
      ],
    };

    // Slack Webhook 호출
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      if (logger) {
        await logger.error(
          `Slack 알림 발송 실패: ${response.status} ${response.statusText}`
        );
      }
      return false;
    }

    if (logger) {
      await logger.info('Slack 알림 발송 완료');
    }
    return true;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    if (logger) {
      await logger.error(`Slack 알림 발송 중 오류: ${error}`);
    }
    return false;
  }
}
