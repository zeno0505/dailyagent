'use strict';

/**
 * AI 프롬프트 템플릿 생성기
 * notion-cron-job.sh의 PROMPT heredoc (68~199행)을 JS 템플릿으로 포팅
 */
function generatePrompt({ notionDbUrl, workDir, columns }) {
  const col = {
    status: columns.column_status || '상태',
    statusWait: columns.column_status_wait || '작업 대기',
    statusComplete: columns.column_status_complete || '검토 전',
    columnPriority: columns.column_priority || '우선순위',
    baseBranch: columns.column_base_branch || '기준 브랜치',
    workBranch: columns.column_work_branch || '작업 브랜치',
  };

  return `# Notion 작업 자동화 실행

현재 작업 디렉토리: ${workDir}

## 작업 수행 단계

### 1단계: Notion 데이터베이스 조회
MCP 도구 \`notion-query-database-view\`를 사용하여 데이터 조회:
- 데이터베이스 URL: ${notionDbUrl}
- "${col.status}"가 ${col.statusWait}이면서, "${col.baseBranch}"가 설정된 항목 조회
- 만약 "선행 작업"이 존재하는데, 선행 작업이 완료되지 않았다면 해당 항목은 무시
- ${col.columnPriority}가 가장 높거나 가장 오래된 항목 1개 선택
- 만약 "${col.statusWait}" 항목이 없으면 작업을 종료하고 그 사실을 보고

### 2단계: 작업 상세 내용 확인
MCP 도구 \`notion-fetch\`를 사용하여 선택된 페이지의 상세 내용 읽기:
- 페이지 ID 또는 URL 사용
- 작업 요구사항, 기술 스택, 관련 파일 등 분석
- 작업 범위와 복잡도 평가

### 3단계: Git 작업 준비
${workDir} 디렉토리에서:
1. 현재 브랜치 확인: \`git branch --show-current\`
2. 작업 중인 변경사항 확인: \`git status --porcelain\`
2-1. 작업중인 변경사항이 있다면 stash
3. 노션 문서 내에 있는 "${col.baseBranch}" 브랜치로 전환 및 최신화:
   - \`git checkout <${col.baseBranch}>\`
   - \`git pull origin <${col.baseBranch}>\`
4. 의미있는 브랜치명 생성 및 생성:
   - 형식: \`feature/<작업유형>/<간단한설명>\` 또는 \`fix/<문제설명>\`
   - 예: \`feature/ui/add-login-form\`, \`fix/api/null-check\`
   - \`git checkout -b <브랜치명>\`

### 4단계: 작업 수행
작업 내용에 따라:
1. 필요한 파일 생성/수정
2. 코드 작성 시 Best Practices 준수
3. Linter/TypeScript 에러 확인 및 수정
4. 작은 단위로 커밋:
   - Conventional Commits 형식 사용 (feat:, fix:, refactor:, docs:, test:, etc.)
   - 예: \`feat: 로그인 폼 컴포넌트\`
   - \`git add <files>\` → \`git commit -m "<message>"\`

### 5단계: 작업 검증
기존에 작업한 내용을 확인하여
1. 기존에 계획했던 작업이 목적에 맞게 수행되었는지 검토
2. 현재 작업으로 인하여 발생하는 사이드 이펙트는 없는지 확인
3. 만약 검토 결과 문제가 있다면 수정하고 다시 검토
4. 검토 결과 문제가 없다면 다음 단계로 이동

### 6단계: Git Push
1. 원격 저장소에 브랜치 푸시: \`git push -u origin <브랜치명>\`
2. Push 결과 확인
3. 브랜치 URL 또는 커밋 해시 기록

### 7단계: Notion 업데이트
MCP 도구 \`notion-update-page\`를 사용하여 페이지 업데이트:

**속성 업데이트:**
- ${col.status}: "${col.statusWait}" → "${col.statusComplete}"
- ${col.workBranch}: {브랜치명} (작업했던 브랜치 명을 기록)

**본문에 작업 결과 추가:**
\`\`\`markdown

---

## 자동화 작업 완료

**완료 시간:** {YYYY-MM-DD HH:MM:SS}

**Git 브랜치:** \`{브랜치명}\`

**커밋 해시:** \`{커밋해시}\`

**수행 작업 요약:**
{작업 요약}

\`\`\`

### 8단계: 결과 보고
JSON 형식으로 결과를 반환:
\`\`\`json
{
  "success": true,
  "task_id": "페이지 ID",
  "task_title": "작업 제목",
  "branch_name": "브랜치명",
  "commits": [
    {
      "hash": "커밋해시",
      "message": "커밋메시지"
    }
  ],
  "files_changed": ["파일1", "파일2"],
  "summary": "작업 요약",
  "notion_updated": true
}
\`\`\`

## 에러 처리
에러 발생 시:
1. 에러 메시지와 스택 트레이스 기록
2. Notion 페이지 업데이트 (가능한 경우):
   - ${col.status}: "에러" 또는 "검토 필요"
   - 에러 내용을 본문에 추가
3. JSON 에러 응답 반환:
\`\`\`json
{
  "success": false,
  "error": "에러 메시지",
  "task_id": "페이지 ID (있는 경우)",
  "partial_work": "부분적으로 수행된 작업 설명"
}
\`\`\`

## 중요 주의사항
1. API 키, 비밀번호, 토큰 등 민감한 정보는 절대 커밋하지 않음
2. 작업이 복잡하거나 불명확하면 Notion에 "검토 필요"로 표시
3. 기존 변경사항이 있으면 작업을 중단하고 보고
4. 작업 시간이 오래 걸릴 것 같으면 중간 진행상황을 Notion에 기록
5. 모든 명령은 ${workDir} 디렉토리에서 실행

## 언어
- 커밋 메시지는 접두사(feat, fix, refactor)와 한국어로 작성
`;
}

module.exports = { generatePrompt };
