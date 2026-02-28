/**
 * Notion SDK 클라이언트
 * 공식 @notionhq/client SDK를 사용하여 안정적인 Notion API 상호작용
 */

import { Client, isNotionClientError } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import type {
  PageObjectResponse,
  UpdatePageParameters,
  AppendBlockChildrenParameters,
} from './types/notion-api.js';

import { resolveColumns } from './config.js';
import {
  parseSelectProperty,
  parseStatusProperty,
  parseDateProperty,
  parseRelationProperty,
  parseNumberProperty,
  parseRichTextProperty,
} from './utils/notion-api.js';
import { ColumnConfig } from './types/config.js';
import { TaskInfo } from './types/core.js';

let _cachedToken: string | undefined;
let _cachedClient: Client | undefined;
let _cachedN2m: NotionToMarkdown | undefined;

function createClient(apiToken: string): { client: Client; n2m: NotionToMarkdown } {
  if (_cachedToken !== apiToken || !_cachedClient || !_cachedN2m) {
    _cachedClient = new Client({ auth: apiToken });
    _cachedN2m = new NotionToMarkdown({ notionClient: _cachedClient });
    _cachedToken = apiToken;
  }
  return { client: _cachedClient, n2m: _cachedN2m };
}

/**
 * Notion 페이지의 블록 내용을 마크다운 문자열로 변환
 * notion-to-md 라이브러리를 사용하여 페이지네이션과 블록 변환을 처리
 */
async function fetchPageContent(n2m: NotionToMarkdown, pageId: string): Promise<string> {
  const mdBlocks = await n2m.pageToMarkdown(pageId);
  const mdStringObj = n2m.toMarkdownString(mdBlocks);
  return (mdStringObj['parent'] ?? '').trim();
}

interface TaskCandidate {
  page: PageObjectResponse;
  priority: number;
  createdTime: Date;
  prerequisiteCompleted: boolean;
}

/**
 * 선행 작업이 완료되었는지 확인
 */
async function checkPrerequisiteCompleted(
  client: Client,
  prerequisitePageId: string,
  columns: ColumnConfig
): Promise<boolean> {
  const { columnStatus, statusComplete } = resolveColumns(columns);

  try {
    const pageResponse = await client.pages.retrieve({
      page_id: prerequisitePageId,
    });

    if (pageResponse.object !== 'page') {
      return true;
    }

    const pageData = pageResponse as PageObjectResponse;
    const statusProp = pageData.properties[columnStatus];
    const statusValue = parseStatusProperty(statusProp);

    if (statusValue) {
      return statusValue === statusComplete;
    }

    return false;
  } catch (error) {
    // 선행 작업 페이지를 찾을 수 없는 경우(404)에만 완료된 것으로 간주
    if (isNotionClientError(error) && error.code === 'object_not_found') {
      return true;
    }
    throw error;
  }
}

/**
 * 우선도 계산: 우선순위가 높을수록, 작업 일자가 오래될수록 높은 점수
 */
function calculatePriority({ createdTime, priority }: TaskCandidate): number {
  const daysSinceCreation = (Date.now() - createdTime.getTime()) / (1000 * 60 * 60 * 24);
  // 우선순위는 가중치 100, 경과 일수는 가중치 1
  return priority * 100 + daysSinceCreation;
}

/**
 * Notion SDK를 사용하여 작업 대기 항목 조회
 */
export async function fetchPendingTask(
  apiToken: string,
  databaseId: string,
  columns: ColumnConfig
): Promise<TaskInfo | null> {
  const { client, n2m } = createClient(apiToken);

  const {
    columnStatus,
    statusWait,
    columnBaseBranch,
    columnPriority,
    columnPrerequisite,
    columnCreatedTime,
  } = resolveColumns(columns);

  // 데이터베이스 쿼리
  const queryResponse = await client.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        {
          property: columnStatus,
          status: {
            equals: statusWait,
          },
        },
        {
          property: columnBaseBranch,
          rich_text: {
            is_not_empty: true,
          },
        },
      ],
    },
    sorts: [
      {
        property: columnPriority,
        direction: 'descending',
      },
      {
        property: columnCreatedTime,
        direction: 'ascending',
      },
    ],
    page_size: 20,
  });

  if (queryResponse.results.length === 0) {
    return null;
  }

  // 각 항목의 우선도 계산 및 선행 작업 확인
  const candidates: TaskCandidate[] = [];

  for (const result of queryResponse.results) {
    if (result.object !== 'page') continue;

    const page = result as PageObjectResponse;
    const properties = page.properties;

    // 우선순위 추출
    let priority = 0;
    const priorityProp = properties[columnPriority];
    const properyValue = parseSelectProperty(priorityProp);
    if (properyValue) {
      priority = parseInt(properyValue.replace(/[^0-9]/g, ''), 10) || 0;
    }

    // 작업 일자 추출
    let createdTime = new Date();
    const createdTimeProp = properties[columnCreatedTime];
    const createdTimeValue = parseDateProperty(createdTimeProp);
    if (createdTimeValue) {
      createdTime = createdTimeValue;
    }

    // 선행 작업 확인
    let prerequisiteCompleted = true;
    const prerequisiteProp = properties[columnPrerequisite];
    const prerequisiteValue = parseRelationProperty(prerequisiteProp);
    if (prerequisiteValue && prerequisiteValue.length > 0) {
      const checkArr = await Promise.all(
        prerequisiteValue.map((id) => checkPrerequisiteCompleted(client, id, columns))
      );
      prerequisiteCompleted = checkArr.every((result) => result);
    }

    candidates.push({
      page,
      priority,
      createdTime,
      prerequisiteCompleted,
    });
  }

  // 선행 작업이 완료된 항목만 필터링
  const validCandidates = candidates.filter((c) => c.prerequisiteCompleted);

  if (validCandidates.length === 0) {
    return null;
  }

  // 우선도 계산 및 정렬 (P1~P5 순으로 정렬되어야 함 -> 오름차순 정렬)
  validCandidates.sort((a, b) => calculatePriority(a) - calculatePriority(b));

  // 최우선 항목 선택
  const selectedCandidate = validCandidates[0];
  if (!selectedCandidate) {
    return null;
  }

  const page = selectedCandidate.page;

  const requirements = await fetchPageContent(n2m, page.id);

  // 속성 추출
  const properties = page.properties;
  const titleProp = properties['제목'] || properties['Name'] || properties['Title'];
  const baseBranchProp = properties[columnBaseBranch];

  let taskTitle = '';
  if (titleProp?.type === 'title') {
    taskTitle = titleProp.title.map((t) => t.plain_text).join('');
  }

  let baseBranch = '';
  if (baseBranchProp?.type === 'rich_text') {
    baseBranch = baseBranchProp.rich_text.map((t) => t.plain_text).join('');
  }

  return {
    task_id: page.id,
    task_title: taskTitle,
    base_branch: baseBranch,
    requirements,
    page_url: page.url,
  };
}

/**
 * Notion SDK를 사용하여 검토 전 태스크 조회
 * 상태가 '검토 전'이면서 검토 횟수가 maxReviewCount 미만인 항목 반환
 */
export async function fetchReviewTask(
  apiToken: string,
  databaseId: string,
  columns: ColumnConfig,
  maxReviewCount: number
): Promise<TaskInfo | null> {
  const { client, n2m } = createClient(apiToken);

  const {
    columnStatus,
    statusReview,
    columnBaseBranch,
    columnPriority,
    columnPrerequisite,
    columnCreatedTime,
    columnWorkBranch,
    columnReviewCount,
  } = resolveColumns(columns);

  // 검토 전 상태이면서 검토 횟수가 maxReviewCount 미만인 항목 조회
  const queryResponse = await client.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        {
          property: columnStatus,
          status: {
            equals: statusReview,
          },
        },
        {
          property: columnBaseBranch,
          rich_text: {
            is_not_empty: true,
          },
        },
        {
          or: [
            {
              property: columnReviewCount,
              number: {
                is_empty: true,
              },
            },
            {
              property: columnReviewCount,
              number: {
                less_than: maxReviewCount,
              },
            },
          ],
        },
      ],
    },
    sorts: [
      {
        property: columnPriority,
        direction: 'descending',
      },
      {
        property: columnCreatedTime,
        direction: 'ascending',
      },
    ],
    page_size: 20,
  });

  if (queryResponse.results.length === 0) {
    return null;
  }

  // 선행 작업 확인 및 우선도 계산
  const candidates: TaskCandidate[] = [];

  for (const result of queryResponse.results) {
    if (result.object !== 'page') continue;

    const page = result as PageObjectResponse;
    const properties = page.properties;

    let priority = 0;
    const priorityProp = properties[columnPriority];
    const priorityValue = parseSelectProperty(priorityProp);
    if (priorityValue) {
      priority = parseInt(priorityValue.replace(/[^0-9]/g, ''), 10) || 0;
    }

    let createdTime = new Date();
    const createdTimeProp = properties[columnCreatedTime];
    const createdTimeValue = parseDateProperty(createdTimeProp);
    if (createdTimeValue) {
      createdTime = createdTimeValue;
    }

    let prerequisiteCompleted = true;
    const prerequisiteProp = properties[columnPrerequisite];
    const prerequisiteValue = parseRelationProperty(prerequisiteProp);
    if (prerequisiteValue && prerequisiteValue.length > 0) {
      const checkArr = await Promise.all(
        prerequisiteValue.map((id) => checkPrerequisiteCompleted(client, id, columns))
      );
      prerequisiteCompleted = checkArr.every((result) => result);
    }

    candidates.push({ page, priority, createdTime, prerequisiteCompleted });
  }

  const validCandidates = candidates.filter((c) => c.prerequisiteCompleted);
  if (validCandidates.length === 0) return null;

  validCandidates.sort((a, b) => calculatePriority(a) - calculatePriority(b));

  const selectedCandidate = validCandidates[0];
  if (!selectedCandidate) return null;

  const page = selectedCandidate.page;

  const requirements = await fetchPageContent(n2m, page.id);

  const properties = page.properties;
  const titleProp = properties['제목'] || properties['Name'] || properties['Title'];
  const baseBranchProp = properties[columnBaseBranch];
  const workBranchProp = properties[columnWorkBranch];
  const reviewCountProp = properties[columnReviewCount];

  let taskTitle = '';
  if (titleProp?.type === 'title') {
    taskTitle = titleProp.title.map((t) => t.plain_text).join('');
  }

  let baseBranch = '';
  if (baseBranchProp?.type === 'rich_text') {
    baseBranch = baseBranchProp.rich_text.map((t) => t.plain_text).join('');
  }

  const workBranch = parseRichTextProperty(workBranchProp) || '';
  const reviewCount = parseNumberProperty(reviewCountProp) ?? 0;

  return {
    task_id: page.id,
    task_title: taskTitle,
    base_branch: baseBranch,
    work_branch: workBranch,
    requirements,
    page_url: page.url,
    review_count: reviewCount,
    is_review: true,
  };
}

/**
 * Notion 페이지의 검토 횟수를 1 증가시킴
 */
export async function incrementReviewCount(
  apiToken: string,
  pageId: string,
  columnReviewCount: string,
  currentCount: number
): Promise<void> {
  const { client } = createClient(apiToken);

  await client.pages.update({
    page_id: pageId,
    properties: {
      [columnReviewCount]: {
        number: currentCount + 1,
      },
    } as NonNullable<UpdatePageParameters['properties']>,
  });
}

/**
 * Notion SDK를 사용하여 페이지 업데이트
 */
export async function updateNotionPage(
  apiToken: string,
  pageId: string,
  properties: Record<string, unknown>,
  content?: string
): Promise<void> {
  const { client } = createClient(apiToken);

  // 속성 업데이트
  await client.pages.update({
    page_id: pageId,
    properties: properties as NonNullable<UpdatePageParameters['properties']>,
  });

  // 본문 내용 추가 (선택적)
  if (content) {
    const blocks = content
      .split('\n')
      .filter((line) => line !== '')
      .map((line) => {
        if (line.trim() === '---') {
          return {
            type: 'divider' as const,
            divider: {},
          };
        }
        if (line.startsWith('# ')) {
          return {
            type: 'heading_1' as const,
            heading_1: {
              rich_text: [{ type: 'text' as const, text: { content: line.slice(2) } }],
            },
          };
        } else if (line.startsWith('## ')) {
          return {
            type: 'heading_2' as const,
            heading_2: {
              rich_text: [{ type: 'text' as const, text: { content: line.slice(3) } }],
            },
          };
        } else if (line.startsWith('**') && line.endsWith('**')) {
          return {
            type: 'paragraph' as const,
            paragraph: {
              rich_text: [
                {
                  type: 'text' as const,
                  text: { content: line.slice(2, -2) },
                  annotations: { bold: true },
                },
              ],
            },
          };
        } else {
          return {
            type: 'paragraph' as const,
            paragraph: {
              rich_text: [{ type: 'text' as const, text: { content: line } }],
            },
          };
        }
      });

    await client.blocks.children.append({
      block_id: pageId,
      children: blocks as AppendBlockChildrenParameters['children'],
    });
  }
}
