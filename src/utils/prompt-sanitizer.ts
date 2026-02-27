/**
 * 프롬프트 주입(Prompt Injection) 방어를 위한 sanitize 유틸리티
 *
 * Notion DB 같은 외부 시스템에서 가져온 데이터를 LLM 프롬프트에 삽입하기 전에
 * 악의적인 지시나 shell 메타문자를 제거하거나 이스케이핑합니다.
 */

import { TaskInfo } from '../types/core.js';

/**
 * 프롬프트에 안전하게 삽입 가능한 TaskInfo의 서브셋
 * is_review, page_url, review_count 같은 내부 메타데이터는 제외합니다.
 */
export interface SafeTaskContext {
  task_title: string;
  base_branch: string;
  requirements: string;
}

/**
 * 재검토 프롬프트에 필요한 추가 필드
 * work_branch는 shell 명령에 삽입되므로 엄격한 검증이 적용됩니다.
 */
export interface SafeReviewContext extends SafeTaskContext {
  work_branch: string;
  review_count: number;
}

/**
 * git 브랜치명에서 허용된 문자만 통과시킵니다.
 *
 * 허용: 알파벳(대소문자), 숫자, /, -, _, .
 * 위반 시: Error를 발생시킵니다 (조용히 제거하지 않음).
 *
 * 이 함수는 shell 명령에 직접 삽입되는 값에 사용해야 합니다.
 */
export function sanitizeGitBranchName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('브랜치명이 비어 있습니다.');
  }
  if (!/^[a-zA-Z0-9/_.\-]+$/.test(trimmed)) {
    throw new Error(
      `유효하지 않은 브랜치명: "${raw}". git 브랜치명은 영문, 숫자, /, -, _, . 만 허용됩니다.`
    );
  }
  return trimmed;
}

/**
 * 프롬프트 삽입 전 문자열에서 마크다운 코드 블록 구분자를 이스케이핑합니다.
 *
 * 백틱 3개 연속(```)은 마크다운 코드 블록의 구분자로 사용되므로,
 * 외부 데이터에 포함된 경우 프롬프트 구조를 파괴할 수 있습니다.
 */
export function sanitizeForPrompt(raw: string): string {
  return raw.replace(/```/g, '` ` `');
}

/**
 * TaskInfo에서 프롬프트 삽입용 안전한 컨텍스트를 추출합니다.
 *
 * - 화이트리스트 필드만 포함 (is_review, page_url, work_branch, review_count 제외)
 * - 각 필드에 코드 블록 구분자 이스케이핑 적용
 */
export function sanitizeTaskContext(taskInfo: TaskInfo): SafeTaskContext {
  return {
    task_title: sanitizeForPrompt(taskInfo.task_title || ''),
    base_branch: sanitizeForPrompt(taskInfo.base_branch || ''),
    requirements: sanitizeForPrompt(taskInfo.requirements || ''),
  };
}

/**
 * 재검토용 컨텍스트를 추출합니다.
 *
 * work_branch는 shell 명령에 직접 삽입되므로 sanitizeGitBranchName으로
 * 엄격한 형식 검증을 수행합니다.
 */
export function sanitizeReviewContext(taskInfo: TaskInfo): SafeReviewContext {
  return {
    ...sanitizeTaskContext(taskInfo),
    work_branch: sanitizeGitBranchName(taskInfo.work_branch || ''),
    review_count: taskInfo.review_count ?? 0,
  };
}
