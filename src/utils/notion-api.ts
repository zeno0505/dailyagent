/**
 * Notion SDK 속성 파싱 유틸리티
 */

/**
 * Notion Select 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Select 타입의 이름 또는 null
 */
export function parseSelectProperty(property: unknown): string | null {
  if (!property || typeof property !== 'object') return null;
  if (!('select' in property)) return null;
  const { select } = property as { select: unknown };
  if (!select || typeof select !== 'object') return null;
  if (!('name' in select)) return null;
  const { name } = select as { name: unknown };
  if (typeof name !== 'string') return null;
  return name;
}

/**
 * Notion Status 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Status 타입의 이름 또는 null
 */
export function parseStatusProperty(property: unknown): string | null {
  if (!property || typeof property !== 'object') return null;
  if (!('status' in property)) return null;
  const { status } = property as { status: unknown };
  if (!status || typeof status !== 'object') return null;
  if (!('name' in status)) return null;
  const { name } = status as { name: unknown };
  if (typeof name !== 'string') return null;
  return name;
}

/**
 * Notion Date 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Date 타입의 날짜 또는 null
 */
export function parseDateProperty(property: unknown): Date | null {
  if (!property || typeof property !== 'object') return null;
  if (!('date' in property)) return null;
  const { date } = property as { date: unknown };
  if (!date || typeof date !== 'object') return null;
  if (!('start' in date)) return null;
  const { start } = date as { start: unknown };
  if (typeof start !== 'string') return null;
  return new Date(start);
}

/**
 * Notion Relation 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Relation 타입의 항목 또는 null
 */
export function parseRelationProperty(property: unknown): string[] | null {
  if (!property || typeof property !== 'object') return null;
  if (!('relation' in property)) return null;
  const { relation } = property as { relation: unknown };
  if (!Array.isArray(relation)) return null;
  return relation.map((item: { id: string }) => item.id);
}
