/**
 * AI 프롬프트 템플릿 생성기
 * 3단계 분리: Phase 1 (Notion 조회), Phase 2 (코드 작업), Phase 3 (Notion 업데이트)
 */

import { resolveColumns } from "../config";
import { ColumnConfig } from "../types/config";
import { TaskInfo, WorkResult, PlanResult, TaskPlanResult } from "../types/core";

/**
 * Phase 1: Notion DB 조회 + 페이지 상세 읽기
 */
export function generateInitialPrompt({ databaseUrl, columns }: { databaseUrl: string; columns: ColumnConfig }): string {
  const col = resolveColumns(columns);

  return `# Phase 1: Notion 작업 조회

## 1단계: Notion 데이터베이스 조회
Notion MCP 도구를 사용하여 데이터 조회:
- 데이터베이스 URL: ${databaseUrl}
- "${col.columnStatus}"가 ${col.statusWait}이면서, "${col.columnBaseBranch}"가 설정된 항목 조회
- 만약 "선행 작업"이 존재하는데, 선행 작업이 완료되지 않았다면 해당 항목은 무시
- ${col.columnPriority}가 가장 높거나 가장 오래된 항목 1개 선택

## 2단계: 작업 상세 내용 확인
Notion MCP 도구를 사용하여 선택된 페이지의 상세 내용 읽기:
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
  "page_url": "페이지 URL",
  "task_mode": "작업 모드 (실행 또는 계획)"
}
\`\`\`
`;
}


/**
 * Phase 2: Git 준비 → 코드 작업 → 검증 → Git Push
 */
export function generateWorkPrompt({ workDir, taskInfo }: { workDir: string; taskInfo: TaskInfo }): string {
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
   - 인증된 경우 base 브랜치(작업 정보의 \`base_branch\`)를 대상으로 Draft PR 생성
   - \`gh pr create --draft --base <base_branch> --title "<작업 제목>" --body "<작업 요약>"\`
   - PR 제목은 작업 제목을 사용
   - PR 본문에 작업 요약 및 변경된 파일 목록 포함
   - PR 생성에 실패해도 **오류를 발생시키지 않고** \`pr_skipped_reason\`에 실패 이유를 설정
   - 생성된 PR URL을 기록

## 결과 출력
반드시 아래 JSON 형식으로만 결과를 반환하세요. 다른 텍스트 없이 JSON만 출력:
\`\`\`json
{
  "branch_name": "작업한 브랜치명",
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
 * Phase 2-1: 개발 계획 작성
 * Notion 작업 요구사항을 분석하여 구체적인 개발 계획 수립
 */
export function generatePlanPrompt({ workDir, taskInfo }: { workDir: string; taskInfo: TaskInfo }): string {
  return `# Phase 2-1: 개발 계획 작성

현재 작업 디렉토리: ${workDir}

## 작업 정보
\`\`\`json
${JSON.stringify(taskInfo, null, 2)}
\`\`\`

## 목표
위 작업 요구사항을 분석하여 구체적인 개발 계획을 수립합니다.

## 수행 단계

### 1단계: 프로젝트 구조 파악
- ${workDir} 디렉토리의 프로젝트 구조를 확인
- 관련 파일 및 코드를 분석

### 2단계: 요구사항 분석
- 작업 요구사항을 세부 항목으로 분해
- 기술적 제약사항 및 의존성 확인

### 3단계: 구현 계획 수립
- 수정/생성할 파일 목록 정리
- 구현 순서 및 단계 정의
- 적절한 브랜치명 결정

### 4단계: Git 작업 준비
${workDir} 디렉토리에서:
1. 현재 브랜치 확인: \`git branch --show-current\`
2. 작업 중인 변경사항 확인: \`git status --porcelain\`
2-1. 작업중인 변경사항이 있다면 stash
3. 작업 정보 내에 있는 "base_branch" 브랜치로 전환 및 최신화:
   - \`git checkout <base_branch>\`
   - \`git pull origin <base_branch>\`
4. 의미있는 브랜치명 생성 및 생성:
   - 형식: \`feature/<작업유형>/<간단한설명>\` 또는 \`fix/<문제설명>\`
   - \`git checkout -b <브랜치명>\`

## 결과 출력
**반드시 아래 JSON 형식으로만 결과를 반환하세요. 다른 텍스트 없이 JSON만 출력**:
\`\`\`json
{
  "plan_summary": "개발 계획 요약",
  "branch_name": "생성한 브랜치명",
  "files_to_modify": ["수정할 파일 목록"],
  "files_to_create": ["새로 생성할 파일 목록"],
  "implementation_steps": ["구현 단계 1", "구현 단계 2", "..."]
}
\`\`\`

## 중요 주의사항
1. 이 단계에서는 코드 구현을 하지 않습니다. 계획 수립만 합니다.
2. 단, Git 브랜치 생성 및 전환은 이 단계에서 수행합니다.
3. 모든 명령은 ${workDir} 디렉토리에서 실행
`;
}

/**
 * Phase 2-2: 실제 구현
 * Phase 2-1에서 수립한 계획에 따라 코드 구현 및 Git 커밋
 */
export function generateImplementPrompt({ planResult }: { planResult: PlanResult }): string {
  return `# Phase 2-2: 실제 구현

## 개발 계획
\`\`\`json
${JSON.stringify(planResult, null, 2)}
\`\`\`

## 목표
위 개발 계획에 따라 코드를 구현하고 Git 커밋합니다.

## 수행 단계

### 1단계: 코드 구현
개발 계획의 implementation_steps에 따라 순서대로 구현:
1. 필요한 파일 생성/수정
2. 코드 작성 시 Best Practices 준수
3. Linter/TypeScript 에러 확인 및 수정

### 2단계: Git 커밋
작은 단위로 커밋:
- Conventional Commits 형식 사용 (feat:, fix:, refactor:, docs:, test:, etc.)
- 예: \`feat: 로그인 폼 컴포넌트 추가\`
- \`git add <files>\` → \`git commit -m "<message>"\`

## 결과 출력
**반드시 아래 JSON 형식으로만 결과를 반환하세요. 다른 텍스트 없이 JSON만 출력**:
\`\`\`json
{
  "commits": [
    { "hash": "커밋해시", "message": "커밋메시지" }
  ],
  "files_changed": ["변경된 파일1", "변경된 파일2"],
  "issues_found": ["발견된 이슈 (없으면 빈 배열)"]
}
\`\`\`

## 중요 주의사항
1. API 키, 비밀번호, 토큰 등 민감한 정보는 절대 커밋하지 않음
2. 커밋 메시지는 접두사(feat, fix, refactor)와 한국어로 작성
3. 이전 대화에서 수립한 계획을 충실히 따릅니다.
`;
}

/**
 * Phase 2-3: 구현 결과 검토
 * 구현된 코드의 품질 검토, 사이드이펙트 확인, Git Push 및 PR 생성
 */
export function generateReviewPrompt({ taskInfo }: { taskInfo: TaskInfo }): string {
  return `# Phase 2-3: 구현 결과 검토 및 Git Push

## 목표
이전 단계에서 구현한 코드를 검토하고, 문제가 없으면 Git Push 및 PR을 생성합니다.

## 수행 단계

### 1단계: 코드 검토
1. 이전 단계에서 구현한 내용이 요구사항에 맞게 수행되었는지 검토
2. 사이드 이펙트가 없는지 확인
3. 코드 품질 (가독성, 유지보수성) 검토
4. Linter/TypeScript 에러가 없는지 확인

### 2단계: 문제 수정
검토 결과 문제가 발견되면:
1. 문제를 수정
2. 수정 사항을 커밋
3. 다시 검토

### 3단계: Git Push
1. 원격 저장소에 브랜치 푸시: \`git push -u origin <브랜치명>\`
2. Push 결과 확인

### 4단계: PR(Pull Request) 생성
1. \`gh\` CLI 설치 여부 확인: \`which gh\`
2. \`gh\` CLI가 설치되어 있지 않은 경우:
   - PR 생성은 건너뛰고, 결과 JSON의 \`pr_url\`을 \`null\`로 설정
   - \`pr_skipped_reason\`에 "gh CLI가 설치되어 있지 않습니다."로 설정
3. \`gh\` CLI가 설치되어 있는 경우:
   - 인증 상태 확인: \`gh auth status\`
   - 인증된 경우 base 브랜치(\`${taskInfo.base_branch || 'main'}\`)를 대상으로 Draft PR 생성
   - \`gh pr create --draft --base ${taskInfo.base_branch || 'main'} --title "<작업 제목>" --body "<작업 요약>"\`
   - PR 생성에 실패해도 오류를 발생시키지 않고 \`pr_skipped_reason\`에 실패 이유를 설정

## 결과 출력
**반드시 아래 JSON 형식으로만 결과를 반환하세요. 다른 텍스트 없이 JSON만 출력**:
\`\`\`json
{
  "branch_name": "작업한 브랜치명",
  "commits": [
    { "hash": "커밋해시", "message": "커밋메시지" }
  ],
  "files_changed": ["파일1", "파일2"],
  "summary": "작업 요약",
  "pr_url": "PR URL 또는 null",
  "pr_skipped_reason": "PR 생성을 건너뛴 이유 또는 null"
}
\`\`\`
`;
}

/**
 * 계획 모드: 작업 계획 수립 프롬프트
 * 작업 요구사항을 분석하여 하위 작업들을 계획
 */
export function generateTaskPlanPrompt({ workDir, taskInfo }: { workDir: string; taskInfo: TaskInfo }): string {
  return `# 작업 계획 수립 (Plan Mode)

현재 작업 디렉토리: ${workDir}

## 작업 정보
\`\`\`json
${JSON.stringify(taskInfo, null, 2)}
\`\`\`

## 목표
위 작업 요구사항을 분석하여 구체적인 하위 작업들을 계획합니다.

## 수행 단계

### 1단계: 프로젝트 구조 파악
- ${workDir} 디렉토리의 프로젝트 구조를 확인
- 기존 코드와 구조를 분석

### 2단계: 요구사항 분석
- 작업 요구사항을 세부 항목으로 분해
- 각 항목의 복잡도와 범위 파악

### 3단계: 하위 작업 계획 수립
- 요구사항을 3-5개의 구체적인 하위 작업으로 분해
- 각 하위 작업은 독립적으로 실행 가능해야 함
- 작업 간의 의존성과 순서 고려

## 결과 출력
**반드시 아래 JSON 형식으로만 결과를 반환하세요. 다른 텍스트 없이 JSON만 출력**:
\`\`\`json
{
  "plan_summary": "전체 작업 계획 요약",
  "subtasks": [
    {
      "title": "하위 작업 제목",
      "requirements": "하위 작업의 상세 요구사항",
      "base_branch": "기준 브랜치 (선택사항, 기본값: ${taskInfo.base_branch || 'main'})"
    }
  ]
}
\`\`\`

## 중요 주의사항
1. 각 subtask는 하나의 Notion 문서로 생성됩니다
2. requirements는 상세하고 구체적이어야 합니다
3. 하위 작업들은 순서대로 실행됩니다
4. base_branch가 없으면 원본 작업의 base_branch를 사용합니다
`;
}

/**
 * Phase 3: Notion 업데이트 + 결과 보고
 */
export function generateFinishPrompt({ 
  taskInfo, 
  workResult, 
  columns, 
  databaseUrl 
}: { 
  taskInfo: TaskInfo; 
  workResult: WorkResult; 
  columns: ColumnConfig; 
  databaseUrl: string;
}): string {
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
- 데이터베이스 URL: ${databaseUrl}

${isSuccess ? `**성공 케이스 - 속성 업데이트:**
- ${col.columnStatus}: "${col.statusWait}" → "${col.statusReview}"
- ${col.columnWorkBranch}: "작업 브랜치명"

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
- ${col.columnStatus}: "${col.statusWait}" → "${col.statusError}"

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
**반드시 아래 JSON 형식으로만 결과를 반환하세요. 다른 텍스트 없이 JSON만 출력**:
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
