/**
 * Notion SDK 속성 파싱 유틸리티
 */

/**
 * Notion Select 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Select 타입의 이름 또는 null
 */
export function parseSelectProperty(property: unknown): string | null {
  if (!property) return null;
  if (typeof property !== 'object' || !('select' in property)) return null;
  const select = (property as any).select;
  if (!select || typeof select !== 'object') return null;
  if (typeof select.name !== 'string') return null;
  return select.name;
}

/**
 * Notion Status 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Status 타입의 이름 또는 null
 */
export function parseStatusProperty(property: unknown): string | null {
  if (!property) return null;
  if (typeof property !== 'object' || !('status' in property)) return null;
  const status = (property as any).status;
  if (!status || typeof status !== 'object') return null;
  if (typeof status.name !== 'string') return null;
  return status.name;
}

/**
 * Notion Date 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Date 타입의 날짜 또는 null
 */
export function parseDateProperty(property: unknown): Date | null {
  if (!property) return null;
  if (typeof property !== 'object' || !('date' in property)) return null;
  const date = (property as any).date;
  if (!date || typeof date !== 'object') return null;
  if (typeof date.start !== 'string') return null;
  return new Date(date.start);
}

/**
 * Notion Relation 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Relation 타입의 항목 또는 null
 */
export function parseRelationProperty(property: unknown): string[] | null {
  if (!property) return null;
  if (typeof property !== 'object' || !('relation' in property)) return null;
  const relation = (property as any).relation;
  if (!Array.isArray(relation)) return null;
  return relation.map((item: { id: string }) => item.id);
}
