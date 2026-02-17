/**
 * Notion API 클라이언트
 * MCP 대신 직접 Notion API를 호출하여 토큰 소비를 최소화
 */

import { resolveColumns } from './config';
import { parseDateProperty, parseRelationProperty, parseSelectProperty, parseStatusProperty } from './utils/notion-api';
import { ColumnConfig } from './types/config';
import { TaskInfo } from './types/core';
import { NOTION_BLOCK_HANDLER, NotionBlock } from './types/notion-api';

export interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
  url: string;
}

export interface NotionQueryResult {
  results: NotionPage[];
}

interface TaskCandidate {
  page: NotionPage;
  priority: number;
  createdTime: Date;
  prerequisiteCompleted: boolean;
}

/**
 * 선행 작업이 완료되었는지 확인
 */
async function checkPrerequisiteCompleted (
  apiToken: string,
  prerequisitePageId: string,
  columns: ColumnConfig
): Promise<boolean> {
  const { columnStatus, statusComplete } = resolveColumns(columns);
  const pageResponse = await fetch(`https://api.notion.com/v1/pages/${prerequisitePageId}`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Notion-Version': '2025-09-03',
    },
  });
  if (!pageResponse.ok) {
    // 선행 작업 페이지를 찾을 수 없으면 완료된 것으로 간주
    return true;
  }

  const pageData = (await pageResponse.json()) as NotionPage;
  const statusProp = pageData.properties[columnStatus];
  const statusValue = parseStatusProperty(statusProp);
  if (statusValue) {
    return statusValue === statusComplete;
  }

  return false;
}

/**
 * 우선도 계산: 우선순위가 높을수록, 작업 일자가 오래될수록 높은 점수
 */
function calculatePriority ({ createdTime, priority }: TaskCandidate): number {
  const daysSinceCreation = (Date.now() - createdTime.getTime()) / (1000 * 60 * 60 * 24);
  // 우선순위는 가중치 100, 경과 일수는 가중치 1
  return priority * 100 + daysSinceCreation;
}

/**
 * Notion API를 사용하여 작업 대기 항목 조회
 * - 여러 항목을 가져와서 클라이언트에서 우선도 계산
 * - 선행 작업이 완료된 항목만 선택
 */
export async function fetchPendingTask (
  apiToken: string,
  datasourceId: string,
  columns: ColumnConfig
): Promise<TaskInfo | null> {
  const { columnStatus, statusWait, columnBaseBranch, columnPriority, columnPrerequisite, columnCreatedTime } = resolveColumns(columns);

  // 데이터베이스 쿼리 (여러 항목 가져오기)
  const queryResponse = await fetch(`https://api.notion.com/v1/data_sources/${datasourceId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Notion-Version': '2025-09-03',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
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
      page_size: 20,  // 여러 항목을 가져와서 클라이언트에서 필터링
    }),
  });

  if (!queryResponse.ok) {
    const errorText = await queryResponse.text();
    throw new Error(`Notion API query failed: ${queryResponse.status} ${errorText}`);
  }

  const queryResult = (await queryResponse.json()) as NotionQueryResult;

  if (queryResult.results.length === 0) {
    return null;
  }

  // 각 항목의 우선도 계산 및 선행 작업 확인
  const candidates: TaskCandidate[] = [];

  for (const page of queryResult.results) {
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
    if (prerequisiteValue) {
      const checkArr = await Promise.all(prerequisiteValue.map((id) => checkPrerequisiteCompleted(apiToken, id, columns)));
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

  // 우선도 계산 및 정렬
  validCandidates.sort((a, b) => {
    return calculatePriority(b) - calculatePriority(a);  // 높은 우선도가 먼저
  });

  // 최우선 항목 선택
  const selectedCandidate = validCandidates[0];
  if (!selectedCandidate) {
    return null;
  }
  const page = selectedCandidate.page;

  // 페이지 상세 정보 조회
  const pageResponse = await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Notion-Version': '2025-09-03',
    },
  });

  if (!pageResponse.ok) {
    const errorText = await pageResponse.text();
    throw new Error(`Notion API page fetch failed: ${pageResponse.status} ${errorText}`);
  }

  const pageData = (await pageResponse.json()) as NotionPage;

  // 페이지 블록 내용 조회
  const blocksResponse = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Notion-Version': '2025-09-03',
    },
  });

  if (!blocksResponse.ok) {
    const errorText = await blocksResponse.text();
    throw new Error(`Notion API blocks fetch failed: ${blocksResponse.status} ${errorText}`);
  }

  const blocksData = (await blocksResponse.json()) as { results: Array<NotionBlock> };

  // 블록 내용을 텍스트로 변환
  let requirements = '';

  for (const block of blocksData.results) {
    if (block.type in NOTION_BLOCK_HANDLER) {
      requirements += NOTION_BLOCK_HANDLER[block.type](block);
    } else {
      console.warn(`   Unknown block type: ${block.type}`);
      console.dir(block, { depth: null });
    }
  }

  // 속성 추출
  const properties = pageData.properties;
  const titleProp = properties['제목'] || properties['Name'] || properties['Title'];
  const baseBranchProp = properties[columnBaseBranch];

  let taskTitle = '';
  if (titleProp && typeof titleProp === 'object' && 'title' in titleProp) {
    const title = titleProp.title as Array<{ plain_text: string }>;
    taskTitle = title.map((t) => t.plain_text).join('');
  }

  let baseBranch = '';
  if (baseBranchProp && typeof baseBranchProp === 'object' && 'rich_text' in baseBranchProp) {
    const richText = baseBranchProp.rich_text as Array<{ plain_text: string }>;
    baseBranch = richText.map((t) => t.plain_text).join('');
  }

  if (!page) {
    return null;
  }

  return {
    task_id: page.id,
    task_title: taskTitle,
    base_branch: baseBranch,
    requirements: requirements.trim(),
    page_url: pageData.url,
  };
}

/**
 * Notion API를 사용하여 페이지 업데이트
 */
export async function updateNotionPage (
  apiToken: string,
  pageId: string,
  properties: Record<string, unknown>,
  content?: string
): Promise<void> {
  // 속성 업데이트
  const updateResponse = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Notion-Version': '2025-09-03',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties,
    }),
  });

  if (!updateResponse.ok) {
    const errorText = await updateResponse.text();
    throw new Error(`Notion API page update failed: ${updateResponse.status} ${errorText}`);
  }

  // 본문 내용 추가 (선택적)
  if (content) {
    const blocks = content.split('\n').filter(line => line !== '').map((line) => {
      if (line.trim() === '---') {
        return {
          object: 'block',
          type: 'divider',
          divider: {},
        };
      }
      if (line.startsWith('# ')) {
        return {
          object: 'block',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: line.slice(2) } }],
          },
        };
      } else if (line.startsWith('## ')) {
        return {
          object: 'block',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: line.slice(3) } }],
          },
        };
      } else if (line.startsWith('**') && line.endsWith('**')) {
        return {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: line.slice(2, -2) }, annotations: { bold: true } }],
          },
        };
      } else {
        return {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content: line } }],
          },
        };
      }
    });

    const appendResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Notion-Version': '2025-09-03',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        children: blocks,
      }),
    });

    if (!appendResponse.ok) {
      const errorText = await appendResponse.text();
      throw new Error(`Notion API block append failed: ${appendResponse.status} ${errorText}`);
    }
  }
}
