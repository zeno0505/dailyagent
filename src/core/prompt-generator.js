'use strict';

/**
 * AI 프롬프트 템플릿 생성기
 * 3단계 분리: Phase 1 (Notion 조회), Phase 2 (코드 작업), Phase 3 (Notion 업데이트)
 */

function resolveColumns(columns) {
  return {
    status: columns.column_status || '상태',
    statusWait: columns.column_status_wait || '작업 대기',
    statusComplete: columns.column_status_complete || '검토 전',
    columnPriority: columns.column_priority || '우선순위',
    baseBranch: columns.column_base_branch || '기준 브랜치',
    workBranch: columns.column_work_branch || '작업 브랜치',
  };
}

/**
 * Phase 1: Notion DB 조회 + 페이지 상세 읽기
 */
function generateInitialPrompt({ notionDbUrl, columns }) {
  const col = resolveColumns(columns);

  return `# Phase 1: Notion 작업 조회

## 1단계: Notion 데이터베이스 조회
MCP 도구 \`notion-query-database-view\`를 사용하여 데이터 조회:
- 데이터베이스 URL: ${notionDbUrl}
- "${col.status}"가 ${col.statusWait}이면서, "${col.baseBranch}"가 설정된 항목 조회
- 만약 "선행 작업"이 존재하는데, 선행 작업이 완료되지 않았다면 해당 항목은 무시
- ${col.columnPriority}가 가장 높거나 가장 오래된 항목 1개 선택
- 만약 "${col.statusWait}" 항목이 없으면 아래 JSON을 반환하고 종료:
\`\`\`json
{ "no_tasks": true }
\`\`\`

## 2단계: 작업 상세 내용 확인
MCP 도구 \`notion-fetch\`를 사용하여 선택된 페이지의 상세 내용 읽기:
- 페이지 ID 또는 URL 사용
- 작업 요구사항, 기술 스택, 관련 파일 등 분석
- 작업 범위와 복잡도 평가

## 결과 출력
반드시 아래 JSON 형식으로만 결과를 반환하세요. 다른 텍스트 없이 JSON만 출력:
\`\`\`json
{
  "task_id": "페이지 ID",
  "task_title": "작업 제목",
  "base_branch": "기준 브랜치명",
  "requirements": "작업 요구사항 전체 내용",
  "page_url": "페이지 URL"
}
\`\`\`
`;
}

/**
 * Phase 2: Git 준비 → 코드 작업 → 검증 → Git Push
 */
function generateWorkPrompt({ workDir, taskInfo }) {
  return `# Phase 2: 코드 작업 및 Git Push

현재 작업 디렉토리: ${workDir}

## 작업 정보
\`\`\`json
${JSON.stringify(taskInfo, null, 2)}
\`\`\`

## 3단계: Git 작업 준비
${workDir} 디렉토리에서:
1. 현재 브랜치 확인: \`git branch --show-current\`
2. 작업 중인 변경사항 확인: \`git status --porcelain\`
2-1. 작업중인 변경사항이 있다면 stash
3. 작업 정보 내에 있는 "base_branch" 브랜치로 전환 및 최신화:
   - \`git checkout <base_branch>\`
   - \`git pull origin <base_branch>\`
4. 의미있는 브랜치명 생성 및 생성:
   - 형식: \`feature/<작업유형>/<간단한설명>\` 또는 \`fix/<문제설명>\`
   - 예: \`feature/ui/add-login-form\`, \`fix/api/null-check\`
   - \`git checkout -b <브랜치명>\`

## 4단계: 작업 수행
작업 내용에 따라:
1. 필요한 파일 생성/수정
2. 코드 작성 시 Best Practices 준수
3. Linter/TypeScript 에러 확인 및 수정
4. 작은 단위로 커밋:
   - Conventional Commits 형식 사용 (feat:, fix:, refactor:, docs:, test:, etc.)
   - 예: \`feat: 로그인 폼 컴포넌트\`
   - \`git add <files>\` → \`git commit -m "<message>"\`

## 5단계: 작업 검증
기존에 작업한 내용을 확인하여
1. 기존에 계획했던 작업이 목적에 맞게 수행되었는지 검토
2. 현재 작업으로 인하여 발생하는 사이드 이펙트는 없는지 확인
3. 만약 검토 결과 문제가 있다면 수정하고 다시 검토
4. 검토 결과 문제가 없다면 다음 단계로 이동

## 6단계: Git Push
1. 원격 저장소에 브랜치 푸시: \`git push -u origin <브랜치명>\`
2. Push 결과 확인
3. 브랜치 URL 또는 커밋 해시 기록

## 7단계: PR(Pull Request) 생성
1. \`gh\` CLI 설치 여부 확인: \`which gh\`
2. \`gh\` CLI가 설치되어 있지 않은 경우:
   - PR 생성은 건너뛰고, 결과 JSON의 \`pr_url\`을 \`null\`로 설정
   - \`pr_skipped_reason\`에 "gh CLI가 설치되어 있지 않습니다. PR 생성은 gh 설치 후 가능합니다."로 설정
   - **오류를 발생시키지 않고** 다음 단계로 진행
3. \`gh\` CLI가 설치되어 있는 경우:
   - 먼저 인증 상태 확인: \`gh auth status\`
   - 인증되지 않은 경우 PR 생성을 건너뛰고 \`pr_skipped_reason\`에 "gh CLI 인증이 필요합니다. gh auth login을 실행하세요."로 설정
   - 인증된 경우 base 브랜치(작업 정보의 \`base_branch\`)를 대상으로 PR 생성
   - \`gh pr create --base <base_branch> --title "<작업 제목>" --body "<작업 요약>"\`
   - PR 제목은 작업 제목을 사용
   - PR 본문에 작업 요약 및 변경된 파일 목록 포함
   - PR 생성에 실패해도 **오류를 발생시키지 않고** \`pr_skipped_reason\`에 실패 이유를 설정
   - 생성된 PR URL을 기록

## 결과 출력
반드시 아래 JSON 형식으로만 결과를 반환하세요. 다른 텍스트 없이 JSON만 출력:
\`\`\`json
{
  "branch_name": "브랜치명",
  "commits": [
    { "hash": "커밋해시", "message": "커밋메시지" }
  ],
  "files_changed": ["파일1", "파일2"],
  "summary": "작업 요약",
  "pr_url": "PR URL 또는 null",
  "pr_skipped_reason": "PR 생성을 건너뛴 이유 또는 null"
}
\`\`\`

## 중요 주의사항
1. API 키, 비밀번호, 토큰 등 민감한 정보는 절대 커밋하지 않음
2. 모든 명령은 ${workDir} 디렉토리에서 실행
3. 커밋 메시지는 접두사(feat, fix, refactor)와 한국어로 작성
`;
}

/**
 * Phase 3: Notion 업데이트 + 결과 보고
 */
function generateFinishPrompt({ taskInfo, workResult, columns, notionDbUrl }) {
  const col = resolveColumns(columns);
  const isSuccess = workResult.success !== false && !workResult.error;

  return `# Phase 3: Notion 업데이트 및 결과 보고

## 작업 정보
\`\`\`json
${JSON.stringify(taskInfo, null, 2)}
\`\`\`

## 코드 작업 결과
\`\`\`json
${JSON.stringify(workResult, null, 2)}
\`\`\`

## Notion 업데이트
위 JSON 작업 정보를 읽고 작업된 내용을 Notion 페이지에 업데이트 합니다.
- **MCP 도구 \`notion-update-page\` 사용**
- 데이터베이스 URL: ${notionDbUrl}

${isSuccess ? `**성공 케이스 - 속성 업데이트:**
- ${col.status}: "${col.statusWait}" → "${col.statusComplete}"
- ${col.workBranch}: "작업 브랜치명"

**본문에 작업 결과 추가:**
\`\`\`markdown

---

## 자동화 작업 완료

**완료 시간:** {YYYY-MM-DD HH:MM:SS}

**커밋 해시:** \`{커밋해시}\`

**PR:** ${workResult.pr_url ? `[${workResult.pr_url}](${workResult.pr_url})` : workResult.pr_skipped_reason || 'PR 정보 없음'}

**수행 작업 요약:**
{작업 요약}

\`\`\`` : `**실패 케이스 - 속성 업데이트:**
- ${col.status}: "${col.statusWait}" → "에러"

**본문에 에러 내용 추가:**
\`\`\`markdown

---

## 자동화 작업 실패

**실패 시간:** {YYYY-MM-DD HH:MM:SS}

**에러 내용:**
{에러 메시지}

\`\`\``}

## 결과 보고
위 JSON 작업 정보를 읽고 작업된 내용을 결과로 반환합니다.
\`\`\`json
{
  "success": ${isSuccess},
  "task_id": "${taskInfo.task_id || ''}",
  "task_title": "${taskInfo.task_title || ''}",
  "branch_name": "${isSuccess ? (workResult.branch_name || '') : ''}",
  "commits": ${isSuccess ? JSON.stringify(workResult.commits || []) : '[]'},
  "files_changed": ${isSuccess ? JSON.stringify(workResult.files_changed || []) : '[]'},
  "pr_url": "${isSuccess ? (workResult.pr_url || '') : ''}",
  "pr_skipped_reason": "${isSuccess ? (workResult.pr_skipped_reason || '') : ''}",
  "summary": "${isSuccess ? (workResult.summary || '') : (workResult.error || '')}",
  "notion_updated": true
}
\`\`\`
`;
}

module.exports = { generateInitialPrompt, generateWorkPrompt, generateFinishPrompt };
