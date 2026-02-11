# Notion 작업 자동화 가이드

이 문서는 Notion 데이터베이스와 연동하여 작업을 자동으로 수행하는 시스템에 대한 설명입니다.

## 📋 개요

5시간마다 자동으로:
1. Notion 데이터베이스에서 "시작 전" 상태의 작업을 조회
2. 그중 하나를 선택하여 작업 수행
3. Git 브랜치를 생성하고 변경사항을 커밋
4. 원격 저장소에 푸시
5. 작업 결과를 Notion에 업데이트

## 🗂️ 파일 구조

```
/Users/fanding/scripts/
├── notion-cron-job.sh          # Cron job 메인 스크립트
├── notion-automation.py        # Python 자동화 스크립트
├── NOTION_AUTOMATION_README.md # 이 파일
├── logs/                       # 로그 파일 저장 디렉토리
│   ├── cron.log               # Cron 실행 로그
│   ├── notion-cron-*.log      # 각 실행별 상세 로그
│   └── notion-automation-*.log # Python 스크립트 로그
```

## ⚙️ 설정 방법

### 1. 기본 요구사항 확인

```bash
# 작업 디렉토리 존재 확인
ls -la ~/dev/web-temp/

# Git 저장소 확인
cd ~/dev/web-temp/
git status

# Notion MCP 서버가 설정되어 있는지 확인
ls -la ~/.cursor/projects/Users-fanding-scripts/mcps/user-Notion/
```

### 2. Cron Job 설정

#### 옵션 1: 5시간마다 실행

```bash
# crontab 편집
crontab -e

# 다음 줄 추가 (5시간마다 실행)
0 */5 * * * /Users/fanding/scripts/notion-cron-job.sh >> /Users/fanding/scripts/logs/cron.log 2>&1
```

#### 옵션 2: 특정 시간에 실행 (오전 9시부터 5시간 간격)

```bash
# crontab 편집
crontab -e

# 다음 줄 추가 (9시, 14시, 19시, 0시, 5시에 실행)
0 9,14,19,0,5 * * * /Users/fanding/scripts/notion-cron-job.sh >> /Users/fanding/scripts/logs/cron.log 2>&1
```

#### 현재 설정 확인

```bash
# 등록된 cron job 확인
crontab -l
```

### 3. 수동 실행 테스트

```bash
# 셸 스크립트 실행
/Users/fanding/scripts/notion-cron-job.sh

# 또는 Python 스크립트 직접 실행
/Users/fanding/scripts/notion-automation.py

# 로그 확인
tail -f /Users/fanding/scripts/logs/cron.log
```

## 🔧 Notion 데이터베이스 구조

대상 데이터베이스: https://www.notion.so/fanding/2f5dcd6504d18085bc98cb3003d032b9?v=2f5dcd6504d181109cb5000ca73f65e4

### 필요한 속성 (Properties)

| 속성명 | 타입 | 설명 |
|--------|------|------|
| 제목 | Title | 작업 제목 |
| 상태 | Select | "시작 전", "진행 중", "완료", "에러" 등 |
| 우선순위 | Number | 숫자가 높을수록 우선순위 높음 |
| 작업 내용 | Text | 수행할 작업의 상세 설명 |
| 브랜치명 | Text | 생성된 Git 브랜치명 (자동 입력) |
| 커밋 해시 | Text | Git 커밋 해시 (자동 입력) |
| 완료 시간 | Date | 작업 완료 시간 (자동 입력) |

### 상태 값 설명

- **시작 전**: 아직 시작하지 않은 작업 (자동화가 선택하는 대상)
- **진행 중**: 현재 작업 중
- **완료**: 작업이 성공적으로 완료됨
- **에러**: 작업 중 오류 발생
- **검토 필요**: 자동화로 처리하기 어려운 작업

## 🤖 AI 프롬프트 사용법

스크립트를 실행하면 `/tmp/notion-task-prompt-*.md` 파일이 생성됩니다.
이 파일의 내용을 Cursor AI에게 전달하여 작업을 수행할 수 있습니다.

### Cursor AI에서 실행하는 방법

1. Cursor IDE 열기
2. `~/dev/web-temp/` 디렉토리 열기
3. AI 채팅에 다음과 같이 입력:

```
다음 작업을 수행해주세요:

1. Notion 데이터베이스에서 "시작 전" 상태의 작업 조회
   - URL: https://www.notion.so/fanding/2f5dcd6504d18085bc98cb3003d032b9?v=2f5dcd6504d181109cb5000ca73f65e4
   - MCP 도구 사용: notion-query-database-view

2. 가장 우선순위가 높은 작업 하나를 선택하여 상세 내용 조회
   - MCP 도구 사용: notion-fetch

3. 작업 내용을 분석하고 적절한 브랜치명 생성
   - 형식: feature/작업타입/간단한설명

4. Git 브랜치 생성 및 작업 수행
   - git checkout -b <branch-name>
   - 작업 수행 (코드 작성/수정)
   - git commit -m "명확한 커밋 메시지"
   - git push -u origin <branch-name>

5. Notion 페이지 업데이트
   - MCP 도구 사용: notion-update-page
   - 상태를 "완료"로 변경
   - 브랜치명, 커밋 해시, 작업 요약 추가
```

## 📊 작업 흐름도

```
┌─────────────────────────────────────────┐
│  Cron Job 실행 (5시간마다)              │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Notion DB 조회 (시작 전 상태)          │
│  - MCP: notion-query-database-view      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  작업 선택 (우선순위 높은 것)            │
│  - MCP: notion-fetch                    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Git 브랜치 생성                        │
│  - git checkout main                    │
│  - git pull                             │
│  - git checkout -b feature/task-name    │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  작업 수행 (AI 또는 수동)               │
│  - 코드 작성/수정                       │
│  - 테스트                               │
│  - 커밋                                 │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Git Push                               │
│  - git push -u origin <branch-name>     │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Notion 업데이트                        │
│  - MCP: notion-update-page              │
│  - 상태 변경, 결과 기록                 │
└─────────────────────────────────────────┘
```

## 🔍 로그 확인

### 실시간 로그 모니터링

```bash
# Cron 실행 로그
tail -f /Users/fanding/scripts/logs/cron.log

# 가장 최근 자동화 로그
ls -t /Users/fanding/scripts/logs/notion-*.log | head -1 | xargs tail -f
```

### 과거 로그 검색

```bash
# 특정 날짜의 로그 찾기
ls /Users/fanding/scripts/logs/notion-*-2026-02-10*.log

# 에러가 포함된 로그 검색
grep -r "ERROR" /Users/fanding/scripts/logs/

# 성공한 작업 찾기
grep -r "성공" /Users/fanding/scripts/logs/
```

## ⚠️ 문제 해결

### Cron Job이 실행되지 않는 경우

```bash
# Cron 서비스 상태 확인 (macOS)
sudo launchctl list | grep cron

# Cron 로그 확인 (macOS)
log show --predicate 'process == "cron"' --last 1h

# 스크립트 실행 권한 확인
ls -la /Users/fanding/scripts/notion-cron-job.sh
```

### Git 오류가 발생하는 경우

```bash
# Git 상태 확인
cd ~/dev/web-temp/
git status

# 변경사항이 있으면 정리
git stash

# 원격 저장소와 동기화
git fetch --all
git pull
```

### Notion MCP 연결 오류

```bash
# MCP 서버 상태 확인
ls -la ~/.cursor/projects/Users-fanding-scripts/mcps/user-Notion/

# Cursor 재시작 후 다시 시도
```

## 🚀 고급 설정

### Claude API를 사용한 완전 자동화

`notion-cron-job.sh`의 주석 처리된 부분을 활성화하고 API 키를 설정:

```bash
export CLAUDE_API_KEY="your-api-key-here"
```

### 작업 필터링 커스터마이징

`notion-automation.py`의 쿼리 로직을 수정하여:
- 특정 라벨이 있는 작업만 선택
- 마감일이 임박한 작업 우선 처리
- 특정 프로젝트의 작업만 처리

### 알림 추가

작업 완료 시 Slack, Discord, 이메일 등으로 알림을 보내도록 확장 가능

## 📝 예제 시나리오

### 시나리오 1: 버그 수정 작업

**Notion 작업 내용:**
```
제목: 로그인 페이지 버튼 클릭 안 됨
상태: 시작 전
우선순위: 10
내용:
- 로그인 페이지에서 "로그인" 버튼 클릭 시 아무 반응 없음
- 콘솔에 에러 메시지: "Cannot read property 'submit' of undefined"
- 파일: src/pages/Login.vue
```

**자동화 결과:**
- 브랜치 생성: `fix/login-button-click-issue-2026-02-10_14-30-00`
- 버그 수정 및 커밋
- Notion에 결과 업데이트:
  - 상태: 완료
  - 브랜치명: fix/login-button-click-issue-2026-02-10_14-30-00
  - 커밋 해시: abc123def456
  - 작업 요약: "로그인 버튼 이벤트 핸들러 수정"

### 시나리오 2: 새 기능 추가

**Notion 작업 내용:**
```
제목: 사용자 프로필 페이지 추가
상태: 시작 전
우선순위: 8
내용:
- 사용자가 자신의 프로필을 볼 수 있는 페이지 생성
- 포함 정보: 이름, 이메일, 가입일, 프로필 사진
- 라우트: /profile
- 컴포넌트: UserProfile.vue
```

**자동화 결과:**
- 브랜치 생성: `feature/user-profile-page-2026-02-10_15-00-00`
- 페이지 생성 및 라우팅 설정
- Notion에 결과 업데이트

## 📚 참고 자료

- [Notion API 문서](https://developers.notion.com/)
- [Notion MCP 서버](https://github.com/notion-mcp/notion-mcp)
- [Cron 표현식 가이드](https://crontab.guru/)
- [Git 브랜치 전략](https://nvie.com/posts/a-successful-git-branching-model/)

## 🤝 기여 및 개선

이 자동화 시스템을 개선하기 위한 아이디어:

1. **더 스마트한 작업 선택**: 우선순위뿐만 아니라 마감일, 작업 시간 추정치 등을 고려
2. **에러 복구**: 작업 실패 시 자동으로 재시도하거나 대체 방법 시도
3. **알림 시스템**: 작업 시작/완료/실패 시 알림 발송
4. **작업 통계**: 완료된 작업 수, 평균 소요 시간 등 대시보드
5. **병렬 처리**: 여러 작업을 동시에 처리 (다른 브랜치에서)

## 📄 라이선스

이 스크립트는 개인 사용을 위해 작성되었습니다.
