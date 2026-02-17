export function withoutCodeBlock(markdown: string): string {
  return markdown.replace(/```[a-zA-Z]*\n([\s\S]*?)\n```/g, '$1');
}