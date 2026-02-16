/**
 * Notion API 클라이언트
 * MCP 대신 직접 Notion API를 호출하여 토큰 소비를 최소화
 */

import { ColumnConfig } from './types/config';

export interface NotionPage {
  id: string;
  properties: Record<string, unknown>;
  url: string;
}

export interface NotionQueryResult {
  results: NotionPage[];
}

export interface TaskInfo {
  task_id: string;
  task_title: string;
  base_branch: string;
  requirements: string;
  page_url: string;
}

/**
 * Notion 데이터베이스 ID 추출
 */
function extractDatabaseId(databaseUrl: string): string {
  // URL 형식: https://www.notion.so/{workspace}/{database_id}?v={view_id}
  const match = databaseUrl.match(/([a-f0-9]{32})/);
  if (!match || !match[1]) {
    throw new Error(`Invalid Notion database URL: ${databaseUrl}`);
  }
  // UUID 형식으로 변환 (8-4-4-4-12)
  const id = match[1];
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

/**
 * Notion 페이지 ID 추출
 */
function extractPageId(pageUrl: string): string {
  // URL 형식: https://www.notion.so/{workspace}/{page_id}
  const match = pageUrl.match(/([a-f0-9]{32})/);
  if (!match || !match[1]) {
    throw new Error(`Invalid Notion page URL: ${pageUrl}`);
  }
  const id = match[1];
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

/**
 * Notion API를 사용하여 작업 대기 항목 조회
 */
export async function fetchPendingTask(
  apiToken: string,
  databaseUrl: string,
  columns: ColumnConfig
): Promise<TaskInfo | null> {
  const databaseId = extractDatabaseId(databaseUrl);
  
  const statusColumn = columns.column_status || '상태';
  const statusWait = columns.column_status_wait || '작업 대기';
  const baseBranchColumn = columns.column_base_branch || '기준 브랜치';

  // 데이터베이스 쿼리
  const queryResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: statusColumn,
            select: {
              equals: statusWait,
            },
          },
          {
            property: baseBranchColumn,
            rich_text: {
              is_not_empty: true,
            },
          },
        ],
      },
      sorts: [
        {
          property: columns.column_priority || '우선순위',
          direction: 'descending',
        },
      ],
      page_size: 1,
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

  const page = queryResult.results[0];
  if (!page) {
    return null;
  }

  // 페이지 상세 정보 조회
  const pageResponse = await fetch(`https://api.notion.com/v1/pages/${page.id}`, {
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Notion-Version': '2022-06-28',
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
      'Notion-Version': '2022-06-28',
    },
  });

  if (!blocksResponse.ok) {
    const errorText = await blocksResponse.text();
    throw new Error(`Notion API blocks fetch failed: ${blocksResponse.status} ${errorText}`);
  }

  const blocksData = (await blocksResponse.json()) as { results: Array<{ type: string; [key: string]: unknown }> };

  // 블록 내용을 텍스트로 변환
  let requirements = '';
  for (const block of blocksData.results) {
    if (block.type === 'paragraph' && block.paragraph) {
      const paragraph = block.paragraph as { rich_text: Array<{ plain_text: string }> };
      requirements += paragraph.rich_text.map((t) => t.plain_text).join('') + '\n';
    } else if (block.type === 'heading_1' && block.heading_1) {
      const heading = block.heading_1 as { rich_text: Array<{ plain_text: string }> };
      requirements += '# ' + heading.rich_text.map((t) => t.plain_text).join('') + '\n';
    } else if (block.type === 'heading_2' && block.heading_2) {
      const heading = block.heading_2 as { rich_text: Array<{ plain_text: string }> };
      requirements += '## ' + heading.rich_text.map((t) => t.plain_text).join('') + '\n';
    } else if (block.type === 'heading_3' && block.heading_3) {
      const heading = block.heading_3 as { rich_text: Array<{ plain_text: string }> };
      requirements += '### ' + heading.rich_text.map((t) => t.plain_text).join('') + '\n';
    } else if (block.type === 'bulleted_list_item' && block.bulleted_list_item) {
      const item = block.bulleted_list_item as { rich_text: Array<{ plain_text: string }> };
      requirements += '- ' + item.rich_text.map((t) => t.plain_text).join('') + '\n';
    } else if (block.type === 'code' && block.code) {
      const code = block.code as { rich_text: Array<{ plain_text: string }>; language: string };
      requirements += '```' + code.language + '\n';
      requirements += code.rich_text.map((t) => t.plain_text).join('') + '\n';
      requirements += '```\n';
    }
  }

  // 속성 추출
  const properties = pageData.properties;
  const titleProp = properties['제목'] || properties['Name'] || properties['Title'];
  const baseBranchProp = properties[baseBranchColumn];

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
export async function updateNotionPage(
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
      'Notion-Version': '2022-06-28',
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
    const blocks = content.split('\n').map((line) => {
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
        'Notion-Version': '2022-06-28',
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
