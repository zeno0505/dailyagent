import chalk from 'chalk';

/**
 * 날짜(문자열 또는 Unix ms 숫자)를 한국 시간으로 포맷합니다.
 * null/undefined면 '-'를 반환합니다.
 */
export function formatDate(dateVal: string | number | null | undefined): string {
  if (dateVal === null || dateVal === undefined) return chalk.gray('-');
  return new Date(dateVal).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

/**
 * 경로 문자열을 maxLength에 맞게 앞부분을 생략하여 잘라냅니다.
 */
export function truncatePath(p: string, maxLength: number): string {
  if (p.length <= maxLength) return p;
  return '...' + p.slice(-(maxLength - 3));
}
