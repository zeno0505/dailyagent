# DailyAgent

> Notion과 Claude Code를 연동한 AI 기반 개발 작업 자동화 CLI

[![npm version](https://img.shields.io/npm/v/dailyagent)](https://www.npmjs.com/package/@zeno0505/dailyagent)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 개발 배경

매일 반복되는 개발 작업(기능 구현, 버그 수정, 리팩토링 등)을 Notion으로 관리하면서, 작업을 직접 실행하는 과정까지 자동화하고 싶다는 필요에서 시작했습니다.

**DailyAgent**는 Notion 데이터베이스에 등록된 작업을 자동으로 가져와 Claude Code CLI(또는 Cursor CLI)에게 실행을 위임하고, 결과를 다시 Notion에 업데이트하는 전체 워크플로우를 자동화합니다.

### 동작 원리

```
Notion DB (작업 대기)
    ↓ Phase 1: 작업 조회
DailyAgent
    ↓ Phase 2: AI 에이전트에게 코드 작업 위임
Claude Code / Cursor
    ↓ Git commit & push
    ↓ Phase 3: 결과 업데이트
Notion DB (완료)
```

---

## ⚠️ 사용 시 주의사항

### 필수 사전 요구사항

DailyAgent를 사용하기 전에 아래 도구들이 반드시 설치 및 설정되어 있어야 합니다.

| 요구사항 | 설명 |
|---|---|
| **Node.js 18+** | [nodejs.org](https://nodejs.org) |
| **Claude Code CLI** | [claude.ai/code](https://claude.ai/code) 또는 `npm install -g @anthropic-ai/claude-code` |
| **Notion API 키** | Notion 문서 자동화를 위한 API Key |
| **Git + SSH 키** | Git push를 위해 SSH 키 인증 필수 |

### SSH 키 설정

DailyAgent는 AI 에이전트가 코드 작업 후 **자동으로 Git push**를 수행합니다. 비밀번호 없이 push가 가능하도록 SSH 키 인증을 반드시 설정해야 합니다.

```bash
# SSH 키 생성 (이미 있으면 생략)
ssh-keygen -t ed25519 -C "your_email@example.com"

# 공개 키를 GitHub/GitLab에 등록
cat ~/.ssh/id_ed25519.pub
```

### Notion 데이터베이스 구조

DailyAgent가 읽고 쓰는 Notion DB에는 아래 속성이 반드시 존재해야 합니다.

| 속성명 (기본값) | 타입 | 설명 |
|---|---|---|
| `제목` | Title | 작업 제목 |
| `상태` | Select | 작업 상태 (작업 대기 / 진행 중 / 완료 / 에러 / 검토 필요) |
| `우선순위` | Select | 작업 우선순위 |
| `기준 브랜치` | Text | 작업 시작 브랜치 (예: `main`) |
| `작업 브랜치` | Text | AI가 작업 후 기록하는 브랜치명 |
| `커밋 해시` | Text | 마지막 커밋 해시 |
| `선행 작업` | Relation | 이 작업보다 먼저 완료되어야 하는 작업 |
| `완료 시간` | Date | 작업 완료 시각 |

> 속성 이름은 `dailyagent init` 설정 시 커스텀으로 변경할 수 있습니다.

### 보안 주의사항

- **API 키, 토큰 등 민감한 정보는 절대 코드에 직접 작성하지 마세요.**
- Notion API 토큰은 환경 변수로 관리하거나 MCP 서버 설정에 저장하세요.
- `.env` 파일은 반드시 `.gitignore`에 추가하세요.

### AI 에이전트 비용

DailyAgent는 Claude Code 또는 Cursor를 AI 에이전트로 사용합니다. **실행 시마다 API 비용이 발생**할 수 있으니 스케줄 및 타임아웃 설정에 주의하세요.

---

## 설치 과정

### 1단계: DailyAgent 설치

```bash
npm install -g dailyagent
```

설치 확인:

```bash
dailyagent --version
```

### 2단계: Claude Code CLI 설치

```bash
npm install -g @anthropic-ai/claude-code
```

Claude에 로그인:

```bash
claude login
```

### 3단계: Notion API Key 설정

DailyAgent 를 사용하기 위해선 Notion 문서를 자동으로 가져오기 위한 API Key 가 필요합니다.

다음 경로에서 Notion API 를 발급받으세요.

https://www.notion.so/profile/integrations/internal


### 4단계: Claude 권한 설정 (선택사항)

`dailyagent init` 실행 시 `~/.dailyagent/claude-settings.json` 파일이 자동으로 생성됩니다. 이 파일은 Claude Code가 실행 중 사용할 수 있는 도구의 권한을 설정합니다.

---

## 사용 가이드

### 기본 워크플로우

```
dailyagent init       # 최초 1회: 설정 초기화
    ↓
dailyagent register   # 작업 등록
    ↓
dailyagent run <name> # 수동 실행 (또는 스케줄로 자동 실행)
```

---

### `dailyagent init` — 초기 설정

최초 1회 실행하여 Notion 연동 정보와 작업 디렉토리를 설정합니다.

```bash
dailyagent init
```

설정 과정에서 입력하는 정보:
- **작업 디렉토리**: AI 에이전트가 코드 작업을 수행할 Git 저장소 경로
- **Notion 데이터베이스 URL**: 작업을 관리하는 Notion DB 페이지 URL
- **Notion 속성 이름**: 상태, 우선순위, 기준 브랜치 등의 컬럼명 (기본값 사용 가능)
- **Slack 알림**: 선택사항, Slack Bot 토큰과 수신자 이메일 입력 시 작업 결과를 DM으로 알림

설정 파일 위치: `~/.dailyagent/dailyagent.config.json`

---

### Slack Bot 설정 (선택사항)

`dailyagent init` 실행 시 Slack 알림을 활성화하면 작업 완료/실패 결과를 DM으로 받을 수 있습니다.

1. [api.slack.com/apps](https://api.slack.com/apps) 에서 Slack App 생성
2. **OAuth & Permissions** 에서 아래 Bot Token Scopes 추가:
   - `chat:write` — DM 메시지 발송
   - `im:write` — DM 채널 열기
   - `users:read.email` — 이메일로 사용자 ID 조회
3. 앱을 워크스페이스에 설치 후 **Bot User OAuth Token** (`xoxb-...`) 복사
4. `dailyagent init` 실행 시 Bot 토큰과 DM 수신자 이메일 입력

---

### `dailyagent register` — 작업 등록

자동화할 작업(Job)을 등록합니다.

```bash
dailyagent register
```

등록 과정에서 설정하는 항목:
- **작업 이름**: 영문 소문자와 하이픈 사용 (예: `my-project`)
- **AI 에이전트**: Claude Code CLI 또는 Cursor CLI
- **모델**: 비용 최적화를 위한 모델 선택 (비워두면 기본값 사용)
- **Cron 스케줄**: 자동 실행 주기 (예: `0 */5 * * *` = 5시간마다)
- **타임아웃**: 최대 실행 시간 (예: `30m`, `1h`)
- **프롬프트 모드**:
  - `기본 프롬프트`: 내장된 3단계 자동화 템플릿 사용
  - `커스텀 프롬프트`: `~/.dailyagent/prompts/<name>.md` 파일을 직접 작성

#### 실행 모드 (기본 프롬프트 사용 시)

| 모드 | 설명 |
|---|---|
| **단일 실행** | 한 세션에서 Notion 조회 → 코드 작업 → 결과 업데이트를 순서대로 수행 |
| **분할 실행** | 계획(Phase 2-1), 구현(Phase 2-2), 검토(Phase 2-3)를 별도 세션으로 분리 실행. 각 단계별 모델과 타임아웃을 개별 설정 가능 |

---

### `dailyagent run <name>` — 작업 실행

등록된 작업을 수동으로 실행합니다.

```bash
dailyagent run my-project
```

실행 흐름:
1. Notion DB에서 `상태 = 작업 대기`인 항목 조회
2. AI 에이전트(Claude Code 등)가 코드 작업 수행 및 Git push
3. Notion DB 상태를 `완료` 또는 `에러`로 업데이트

---

### `dailyagent list` — 작업 목록 조회

등록된 모든 작업과 상태를 확인합니다.

```bash
dailyagent list
```

---

### `dailyagent status <name>` — 작업 상태 조회

특정 작업의 상세 상태와 최근 실행 이력을 확인합니다.

```bash
dailyagent status my-project

# 최근 20회 이력 조회
dailyagent status my-project --count 20
```

---

### `dailyagent schedule` — 자동 스케줄 관리

등록된 Cron 스케줄에 따라 작업을 자동으로 실행하도록 시스템 스케줄러에 등록합니다.

- **macOS**: launchd 사용
- **Linux**: cron 사용

```bash
# 스케줄 활성화
dailyagent schedule on my-project

# 스케줄 비활성화
dailyagent schedule off my-project

# 스케줄 상태 확인
dailyagent schedule status
```

---

### `dailyagent pause <name>` / `dailyagent resume <name>` — 일시 중지 / 재개

작업의 자동 실행을 일시적으로 중지하거나 재개합니다.

```bash
dailyagent pause my-project
dailyagent resume my-project
```

---

### `dailyagent unregister <name>` — 작업 삭제

등록된 작업을 삭제합니다.

```bash
dailyagent unregister my-project
```

---

### `dailyagent logs <name>` — 실행 로그 조회

작업의 실행 로그를 확인합니다.

```bash
dailyagent logs my-project
```

로그 파일 위치: `~/.dailyagent/logs/`

---

## 설정 파일 구조

모든 설정은 `~/.dailyagent/` 디렉토리에 저장됩니다.

```
~/.dailyagent/
├── dailyagent.config.json   # 전체 설정 (Notion 연동, Workspace 등)
├── jobs.json                # 등록된 작업 목록
├── claude-settings.json     # Claude 권한 설정
├── prompts/                 # 커스텀 프롬프트 파일
│   └── my-project.md
└── logs/                    # 실행 로그
    └── my-project-2025-01-15_12-30-00.log
```

---

## 배포 가이드

DailyAgent는 npm 레지스트리를 통해 배포됩니다. GitHub Actions를 사용한 자동 배포 워크플로우가 구성되어 있으며, 배포를 위해서는 `NPM_TOKEN` 시크릿 설정이 필요합니다.

### NPM_TOKEN 설정하기

#### 1단계: npmjs.com에서 Access Token 발급

1. [npmjs.com](https://www.npmjs.com/)에 로그인합니다
2. 우측 상단 프로필 아이콘 클릭 → **Access Tokens** 메뉴로 이동
3. **Generate New Token** 버튼 클릭
4. 토큰 타입 선택 화면에서 **Automation** 선택
   - `Automation` 타입: CI/CD 파이프라인에서 사용하도록 설계된 토큰
   - 읽기/쓰기 권한 포함, 2FA 없이 사용 가능
5. 토큰 이름 입력 (예: `dailyagent-github-actions`)
6. **Generate Token** 클릭
7. 생성된 토큰을 복사합니다 (한 번만 표시되므로 반드시 저장)

> ⚠️ **중요**: 토큰은 생성 직후 한 번만 표시됩니다. 분실 시 재생성해야 합니다.

#### 2단계: GitHub Repository에 Secret 등록

1. GitHub 레포지토리 페이지로 이동
2. **Settings** 탭 클릭
3. 좌측 사이드바에서 **Secrets and variables** → **Actions** 선택
4. **New repository secret** 버튼 클릭
5. Secret 정보 입력:
   - **Name**: `NPM_TOKEN` (정확히 이 이름으로 입력)
   - **Secret**: 1단계에서 복사한 npm 토큰 값 붙여넣기
6. **Add secret** 클릭

#### 3단계: npm 배포 실행

1. GitHub 레포지토리의 **Actions** 탭으로 이동
2. 좌측에서 **Publish to npm** 워크플로우 선택
3. **Run workflow** 드롭다운 클릭
4. 버전 타입 선택:
   - `patch`: 버그 수정 (0.0.1 → 0.0.2)
   - `minor`: 새 기능 추가 (0.0.1 → 0.1.0)
   - `major`: 호환성 깨지는 변경 (0.0.1 → 1.0.0)
5. **Run workflow** 버튼 클릭

워크플로우는 다음 작업을 자동으로 수행합니다:
- 의존성 설치 및 타입 체크
- `package.json` 버전 업데이트
- 빌드 실행
- npm 레지스트리에 패키지 배포
- Git 태그 생성 및 푸시

### 보안 주의사항

- **NPM_TOKEN은 절대 코드나 로그에 노출하지 마세요**
- 토큰은 GitHub Secrets에만 저장하고, 로컬 환경에는 저장하지 마세요
- 토큰이 유출된 경우 즉시 npmjs.com에서 해당 토큰을 삭제하고 새로 생성하세요
- `Automation` 타입 토큰만 사용하세요 (Publish 타입은 2FA 필요)
- 토큰 권한을 정기적으로 검토하고, 사용하지 않는 토큰은 삭제하세요

---

## 라이선스

MIT License © [Zeno](https://github.com/zeno0505)

