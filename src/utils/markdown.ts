/**
 * Extract JSON string from markdown code block.
 * @throws Error when input is null/undefined, empty, or not a string (for clear parsing failure handling)
 */
export function extractJsonFromCodeBlock(markdown: string | null | undefined): string {
  if (markdown == null || typeof markdown !== 'string') {
    throw new Error('extractJsonFromCodeBlock: input is null or not a string');
  }
  const trimmed = markdown.trim();
  if (trimmed === '') {
    throw new Error('extractJsonFromCodeBlock: result is empty (no JSON content from agent)');
  }
  const codeBlockRegex = /```[a-zA-Z]*\n([\s\S]*?)\n```/;
  const match = trimmed.match(codeBlockRegex);
  const extracted = match?.[1] ? match[1].trim() : trimmed;
  if (extracted === '') {
    throw new Error('extractJsonFromCodeBlock: no JSON content in code block');
  }
  return extracted;
}