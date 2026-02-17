export function extractJsonFromCodeBlock(markdown: string): string {
  const codeBlockRegex = /```[a-zA-Z]*\n([\s\S]*?)\n```/;  
  const match = markdown.match(codeBlockRegex);  
  return match?.[1] ? match[1].trim() : markdown.trim();  
}