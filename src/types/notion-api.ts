export const NOTION_BLOCK_HANDLER = {
  'paragraph': (block: NotionBlock) => block.paragraph?.rich_text.map((t) => t.plain_text).join('') || '',
  'heading_1': (block: NotionBlock) => block.heading_1?.rich_text.map((t) => t.plain_text).join('') || '',
  'heading_2': (block: NotionBlock) => block.heading_2?.rich_text.map((t) => t.plain_text).join('') || '',
  'heading_3': (block: NotionBlock) => block.heading_3?.rich_text.map((t) => t.plain_text).join('') || '',
  'bulleted_list_item': (block: NotionBlock) => block.bulleted_list_item?.rich_text.map((t) => `- ${t.plain_text}`).join('\n') || '',
  'numbered_list_item': (block: NotionBlock) => block.numbered_list_item?.rich_text.map((t, index) => `${index + 1}. ${t.plain_text}`).join('\n') || '',
  'code': (block: NotionBlock) => `\`\`\`${block.code?.language || 'text'}\n${block.code?.rich_text.map((t) => t.plain_text).join('') || ''}\n\`\`\``,
  'divider': () => '---',
  'to_do': (block: NotionBlock) => block.to_do?.rich_text.map((t) => t.plain_text).join('') || '',
  'quote': (block: NotionBlock) => block.quote?.rich_text.map((t) => `> ${t.plain_text}`).join('\n') || '',
}

export type NotionBlockType = keyof typeof NOTION_BLOCK_HANDLER;

export type NotionBlock = {
  type: NotionBlockType;
  paragraph?: {
    rich_text: Array<{ plain_text: string }>;
  };
  heading_1?: {
    rich_text: Array<{ plain_text: string }>;
  };
  heading_2?: {
    rich_text: Array<{ plain_text: string }>;
  };
  heading_3?: {
    rich_text: Array<{ plain_text: string }>;
  };
  bulleted_list_item?: {
    rich_text: Array<{ plain_text: string }>;
  };
  numbered_list_item?: {
    rich_text: Array<{ plain_text: string }>;
  };
  to_do?: {
    rich_text: Array<{ plain_text: string }>;
  };
  quote?: {
    rich_text: Array<{ plain_text: string }>;
  },
  code?: {
    language: string;
    rich_text: Array<{ plain_text: string }>;
  };
};