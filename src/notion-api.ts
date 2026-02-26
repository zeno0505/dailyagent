/**
 * Notion SDK 클라이언트
 * 공식 @notionhq/client SDK를 사용하여 안정적인 Notion API 상호작용
 */

import { Client, isNotionClientError } from '@notionhq/client';
import type {
  PageObjectResponse,
  BlockObjectResponse,
  UpdatePageParameters,
  AppendBlockChildrenParameters,
} from './types/notion-api.js';

import { resolveColumns } from './config.js';
import {
  parseSelectProperty,
  parseStatusProperty,
  parseDateProperty,
  parseRelationProperty,
} from './utils/notion-api.js';
import { ColumnConfig } from './types/config.js';
import { TaskInfo } from './types/core.js';

let _cachedToken: string | undefined;
let _cachedClient: Client | undefined;

function createClient(apiToken: string): Client {
  if (_cachedToken !== apiToken || !_cachedClient) {
    _cachedClient = new Client({ auth: apiToken });
    _cachedToken = apiToken;
  }
  return _cachedClient;
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
  const client = createClient(apiToken);

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

  // 페이지 블록 내용 조회 (페이지네이션 처리)
  const allBlocks: BlockObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const blocksResponse = await client.blocks.children.list({
      block_id: page.id,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    const fullBlocks = blocksResponse.results.filter(
      (block): block is BlockObjectResponse => 'type' in block
    );
    allBlocks.push(...fullBlocks);
    cursor = blocksResponse.has_more ? (blocksResponse.next_cursor ?? undefined) : undefined;
  } while (cursor);

  // 블록 내용을 텍스트로 변환
  let numberedListIndex = 0;
  let requirements = '';

  for (const blockData of allBlocks) {
    const blockType = blockData.type;

    switch (blockType) {
      case 'paragraph':
        if ('paragraph' in blockData && blockData.paragraph) {
          requirements += blockData.paragraph.rich_text.map((t) => t.plain_text).join('');
          requirements += '\n';
        }
        break;
      case 'heading_1':
        if ('heading_1' in blockData && blockData.heading_1) {
          requirements += '# ' + blockData.heading_1.rich_text.map((t) => t.plain_text).join('');
          requirements += '\n';
        }
        break;
      case 'heading_2':
        if ('heading_2' in blockData && blockData.heading_2) {
          requirements += '## ' + blockData.heading_2.rich_text.map((t) => t.plain_text).join('');
          requirements += '\n';
        }
        break;
      case 'heading_3':
        if ('heading_3' in blockData && blockData.heading_3) {
          requirements += '### ' + blockData.heading_3.rich_text.map((t) => t.plain_text).join('');
          requirements += '\n';
        }
        break;
      case 'bulleted_list_item':
        if ('bulleted_list_item' in blockData && blockData.bulleted_list_item) {
          requirements += '- ' + blockData.bulleted_list_item.rich_text.map((t) => t.plain_text).join('');
          requirements += '\n';
        }
        break;
      case 'numbered_list_item':
        if ('numbered_list_item' in blockData && blockData.numbered_list_item) {
          numberedListIndex++;
          requirements += `${numberedListIndex}. ` + blockData.numbered_list_item.rich_text.map((t) => t.plain_text).join('');
          requirements += '\n';
        }
        break;
      case 'code':
        if ('code' in blockData && blockData.code) {
          requirements += `\`\`\`${blockData.code.language}\n${blockData.code.rich_text.map((t) => t.plain_text).join('')}\n\`\`\``;
          requirements += '\n';
        }
        break;
      case 'divider':
        requirements += '\n---\n';
        break;
      case 'to_do':
        if ('to_do' in blockData && blockData.to_do) {
          const checked = blockData.to_do.checked ? '[x]' : '[ ]';
          requirements += `- ${checked} ` + blockData.to_do.rich_text.map((t) => t.plain_text).join('');
          requirements += '\n';
        }
        break;
      case 'quote':
        if ('quote' in blockData && blockData.quote) {
          requirements += '> ' + blockData.quote.rich_text.map((t) => t.plain_text).join('');
          requirements += '\n';
        }
        break;
      default:
        console.warn(`   Unknown block type: ${blockType}`);
    }
  }

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
    requirements: requirements.trim(),
    page_url: page.url,
  };
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
  const client = createClient(apiToken);

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
