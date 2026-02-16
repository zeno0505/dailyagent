/**
 * Notion Select 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Select 타입의 이름 또는 null
 */
export function parseSelectProperty(property: unknown): string | null {
  if (!property) return null;
  if (typeof property !== 'object' || !('select' in property)) return null;
  if (typeof property.select !== 'object' || !property.select) return null;
  if (!('name' in property.select)) return null;
  if (typeof property.select.name !== 'string') return null;
  return property.select.name;
}

/**
 * Notion Status 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Status 타입의 이름 또는 null
 */
export function parseStatusProperty(property: unknown): string | null {
  if (!property) return null;
  if (typeof property !== 'object' || !('status' in property)) return null;
  if (typeof property.status !== 'object' || !property.status) return null;
  if (!('name' in property.status)) return null;
  if (typeof property.status.name !== 'string') return null;
  return property.status.name;
}

/**
 * Notion Date 타입을 파싷ㅇ합니다.
 * @param property Notion 속성
 * @returns 설정된 Date 타입의 날짜 또는 null
 */
export function parseDateProperty(property: unknown): Date | null {
  if (!property) return null;
  if (typeof property !== 'object' || !('date' in property)) return null;
  if (typeof property.date !== 'object' || !property.date) return null;
  if (!('start' in property.date)) return null;
  if (typeof property.date.start !== 'string') return null;
  return new Date(property.date.start);
}

/**
 * Notion Relation 타입을 파싱합니다.
 * @param property Notion 속성
 * @returns 설정된 Relation 타입의 항목 또는 null
 */
export function parseRelationProperty(property: unknown) {
  if (!property) return null;
  if (typeof property !== 'object' || !('relation' in property)) return null;
  if (!Array.isArray(property.relation)) return null;
  return property.relation.map((item: { id: string }) => item.id);
}