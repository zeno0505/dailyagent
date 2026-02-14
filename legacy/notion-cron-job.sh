#!/bin/bash

################################################################################
# Notion 자동화 Cron Job 스크립트
#
# 목적: 5시간마다 Notion 데이터베이스에서 "작업 대기" 상태의 작업을 가져와
#       자동으로 작업을 수행하고 결과를 Notion에 업데이트
#
# Cron 설정 (5시간마다 실행):
#   0 */5 * * * /Users/fanding/scripts/notion-cron-job.sh >> /Users/fanding/scripts/logs/cron.log 2>&1
#
# 또는 첫 실행을 오전 9시로 맞추려면:
#   0 9,14,19,0,5 * * * /Users/fanding/scripts/notion-cron-job.sh >> /Users/fanding/scripts/logs/cron.log 2>&1
#
# 수동 테스트:
#   /Users/fanding/scripts/notion-cron-job.sh
################################################################################

set -euo pipefail

# 환경 변수 설정
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$SCRIPT_DIR/logs"
WORK_DIR="$HOME/dev/web-temp"
NOTION_DB_URL="https://www.notion.so/fanding/2f5dcd6504d18085bc98cb3003d032b9?v=2f5dcd6504d181109cb5000ca73f65e4&source=copy_link"
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
LOG_FILE="$LOG_DIR/notion-cron-$TIMESTAMP.log"
RESULT_FILE="$LOG_DIR/notion-result-$TIMESTAMP.json"

# 로그 디렉토리 생성
mkdir -p "$LOG_DIR"

# 로그 함수
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Notion 자동화 작업 시작"
log "=========================================="

# 작업 디렉토리 확인
if [ ! -d "$WORK_DIR" ]; then
    log "ERROR: 작업 디렉토리가 존재하지 않습니다: $WORK_DIR"
    exit 1
fi

log "작업 디렉토리: $WORK_DIR"

# Git 저장소 확인
if [ ! -d "$WORK_DIR/.git" ]; then
    log "ERROR: Git 저장소가 아닙니다: $WORK_DIR"
    exit 1
fi

# Claude Code CLI 설치 확인
if ! command -v claude &> /dev/null; then
    log "ERROR: claude 명령어를 찾을 수 없습니다. Claude Code를 설치해주세요."
    exit 1
fi

log "Claude Code CLI 버전: $(claude --version)"

################################################################################
# AI 프롬프트 생성
################################################################################

PROMPT=$(cat << 'EOF'
# Notion 작업 자동화 실행

현재 작업 디렉토리: ~/dev/web-temp/

## 작업 수행 단계

### 1단계: Notion 데이터베이스 조회
MCP 도구 `notion-query-database-view`를 사용하여 데이터 조회:
- 데이터베이스 URL: https://www.notion.so/fanding/2f5dcd6504d18085bc98cb3003d032b9?v=2f5dcd6504d181109cb5000ca73f65e4&source=copy_link
- "상태"가 작업 대기이면서, "기준 브랜치"가 설정된 항목 조회
- 만약 "선행 작업"이 존재하는데, 선행 작업이 완료되지 않았다면 해당 항목은 무시
- 우선순위가 가장 높거나 가장 오래된 항목 1개 선택
- 만약 "작업 대기" 항목이 없으면 작업을 종료하고 그 사실을 보고

### 2단계: 작업 상세 내용 확인
MCP 도구 `notion-fetch`를 사용하여 선택된 페이지의 상세 내용 읽기:
- 페이지 ID 또는 URL 사용
- 작업 요구사항, 기술 스택, 관련 파일 등 분석
- 작업 범위와 복잡도 평가

### 3단계: Git 작업 준비
~/dev/web-temp/ 디렉토리에서:
1. 현재 브랜치 확인: `git branch --show-current`
2. 작업 중인 변경사항 확인: `git status --porcelain`
2-1. 작업중인 변경사항이 있다면 stash
3. 노션 문서 내에 있는 "기준 브랜치" 브랜치로 전환 및 최신화:
   - `git checkout <기준 브랜치>`
   - `git pull origin <기준 브랜치>`
4. 의미있는 브랜치명 생성 및 생성:
   - 형식: `feature/<작업유형>/<간단한설명>` 또는 `fix/<문제설명>`
   - 예: `feature/ui/add-login-form`, `fix/api/null-check`
   - `git checkout -b <브랜치명>`

### 4단계: 작업 수행
작업 내용에 따라:
1. 필요한 파일 생성/수정
2. 코드 작성 시 Best Practices 준수
3. Linter/TypeScript 에러 확인 및 수정
4. 작은 단위로 커밋:
   - Conventional Commits 형식 사용 (feat:, fix:, refactor:, docs:, test:, etc.)
   - 예: `feat: 로그인 폼 컴포넌트`
   - `git add <files>` → `git commit -m "<message>"`

### 5단계: Git Push
1. 원격 저장소에 브랜치 푸시: `git push -u origin <브랜치명>`
2. Push 결과 확인
3. 브랜치 URL 또는 커밋 해시 기록

### 6단계: Notion 업데이트
MCP 도구 `notion-update-page`를 사용하여 페이지 업데이트:

**속성 업데이트:**
- 상태: "작업 대기" → "검토 전"
- 작업 브랜치: {브랜치명} (작업했던 브랜치 명을 기록)

**본문에 작업 결과 추가:**
```markdown

---

## 자동화 작업 완료

**완료 시간:** {YYYY-MM-DD HH:MM:SS}

**Git 브랜치:** `{브랜치명}`

**커밋 해시:** `{커밋해시}`

**커밋 메시지:**
- {커밋메시지1}
- {커밋메시지2}

**수행 작업 요약:**
{작업 요약}

**주요 변경사항:**
- {변경사항1}
- {변경사항2}

**변경된 파일:**
- `{파일경로1}`
- `{파일경로2}`
```

### 7단계: 결과 보고
JSON 형식으로 결과를 반환:
```json
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
```

## 에러 처리
에러 발생 시:
1. 에러 메시지와 스택 트레이스 기록
2. Notion 페이지 업데이트 (가능한 경우):
   - 상태: "에러" 또는 "검토 필요"
   - 에러 내용을 본문에 추가
3. JSON 에러 응답 반환:
```json
{
  "success": false,
  "error": "에러 메시지",
  "task_id": "페이지 ID (있는 경우)",
  "partial_work": "부분적으로 수행된 작업 설명"
}
```

## 중요 주의사항
1. ⚠️ API 키, 비밀번호, 토큰 등 민감한 정보는 절대 커밋하지 않음
2. ⚠️ 작업이 복잡하거나 불명확하면 Notion에 "검토 필요"로 표시
3. ⚠️ 기존 변경사항이 있으면 작업을 중단하고 보고
4. 작업 시간이 오래 걸릴 것 같으면 중간 진행상황을 Notion에 기록
5. 모든 명령은 ~/dev/web-temp/ 디렉토리에서 실행

## 언어
- 커밋 메시지는 영어로 작성
- Notion 업데이트 내용은 한국어와 영어 혼용 가능
EOF
)

################################################################################
# Claude Code 실행
################################################################################

log ""
log "Claude Code를 통해 작업 실행 중..."
log "작업 디렉토리: $WORK_DIR"
log ""

# Claude Code 실행 (작업 디렉토리를 명시적으로 지정)
cd "$WORK_DIR"

# 프롬프트를 임시 파일로 저장 (긴 프롬프트 처리)
PROMPT_TMP="/tmp/notion-prompt-$TIMESTAMP.txt"
echo "$PROMPT" > "$PROMPT_TMP"

log "프롬프트 파일: $PROMPT_TMP"
log "Claude 명령 실행 시작: $(date '+%Y-%m-%d %H:%M:%S')"

# Claude Code 실행 옵션 선택
# 옵션 1: 모든 권한 자동 승인 (빠르지만 위험할 수 있음)
# 옵션 2: 설정 파일 사용 (더 안전함, claude-automation-settings.json 필요)

CLAUDE_SETTINGS_FILE="$SCRIPT_DIR/claude-automation-settings.json"

if [ -f "$CLAUDE_SETTINGS_FILE" ]; then
    log "설정 파일 사용: $CLAUDE_SETTINGS_FILE"
    # -p: 프린트 모드 (비대화형)
    # --output-format json: JSON 형식으로 결과 출력
    # --no-session-persistence: 세션을 저장하지 않음
    # --settings: 권한 및 도구 설정 파일
    # --dangerously-skip-permissions: MCP 호출을 위해 추가 권한 자동 승인
    cat "$PROMPT_TMP" | claude -p \
      --output-format json \
      --no-session-persistence \
      --settings "$CLAUDE_SETTINGS_FILE" \
      --dangerously-skip-permissions \
      > "$RESULT_FILE" 2>&1
else
    log "WARNING: 설정 파일이 없습니다. 모든 권한 자동 승인 모드로 실행합니다."
    # --dangerously-skip-permissions: 권한 프롬프트 자동 승인 (자동화에 필수)
    cat "$PROMPT_TMP" | claude -p \
      --output-format json \
      --no-session-persistence \
      --dangerously-skip-permissions \
      > "$RESULT_FILE" 2>&1
fi

CLAUDE_EXIT_CODE=$?

log "Claude 명령 실행 완료: $(date '+%Y-%m-%d %H:%M:%S')"
log "Exit Code: $CLAUDE_EXIT_CODE"

# 임시 파일 삭제
rm -f "$PROMPT_TMP"

log ""
log "=========================================="
log "Claude Code 실행 완료 (Exit Code: $CLAUDE_EXIT_CODE)"
log "=========================================="

# 결과 파일 확인
if [ -f "$RESULT_FILE" ]; then
    log "결과 파일: $RESULT_FILE"
    log ""
    log "실행 결과:"
    log "----------------------------------------"
    cat "$RESULT_FILE" | tee -a "$LOG_FILE"
    log "----------------------------------------"
else
    log "ERROR: 결과 파일이 생성되지 않았습니다"
fi

log ""
log "로그 파일: $LOG_FILE"
log "작업 완료 시간: $(date '+%Y-%m-%d %H:%M:%S')"
log "=========================================="

exit $CLAUDE_EXIT_CODE