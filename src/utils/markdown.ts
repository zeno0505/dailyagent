/**
 * Extract JSON from markdown code block, with fallback to raw string
 * @param markdown - Markdown string that may contain a JSON code block
 * @returns Extracted JSON string, or empty string if no valid content found
 */
export function extractJsonFromCodeBlock(markdown: string): string {
  if (!markdown || markdown.trim() === '') {
    return '';
  }

  const codeBlockRegex = /[\x60]{3}(?:json)?\n([\s\S]*?)\n[\x60]{3}/g;
  const matches = Array.from(markdown.matchAll(codeBlockRegex));
  if (matches.length > 0) {
    return matches[matches.length - 1]?.[1]?.trim() || '';
  }


  // Fallback: return raw markdown if no code block found
  const trimmed = markdown.trim();
  return trimmed || '';
}