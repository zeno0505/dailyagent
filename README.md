# Daily Agent - Notion 자동화 시스템

Notion 데이터베이스와 연동하여 작업을 자동으로 수행하는 AI 기반 자동화 시스템입니다.

## 📋 개요

이 시스템은 주기적으로 Notion 데이터베이스를 확인하여 "작업 대기" 상태의 작업을 가져와 자동으로 수행합니다:

1. Notion 데이터베이스에서 작업 조회
2. 우선순위에 따라 작업 선택
3. Git 브랜치 생성 및 작업 수행
4. 변경사항 커밋 및 푸시
5. 작업 결과를 Notion에 업데이트

## 🎯 주요 기능

- ✅ Notion 데이터베이스 자동 조회
- ✅ Claude Code CLI를 통한 AI 기반 작업 수행
- ✅ Git 브랜치 자동 생성 및 관리
- ✅ 작업 결과 자동 기록
- ✅ 에러 처리 및 로깅
- ✅ 웹 UI를 통한 작업 모니터링 (Cronicle)

## 🏗️ 아키텍처

### 현재 지원하는 스케줄러

1. **Cronicle (권장)** - Node.js 기반 분산 작업 스케줄러
   - ✅ 웹 UI로 작업 관리
   - ✅ 실시간 로그 확인
   - ✅ 작업 히스토리 추적
   - ✅ 이메일/웹훅 알림
   - ✅ 멀티 서버 지원

2. **cron/launchd (레거시)** - 전통적인 Unix 스케줄러
   - 간단한 설정
   - 로그 파일 기반 모니터링

## 🚀 빠른 시작

### Cronicle 사용 (권장)

**일반 설치:**
```bash
# 1. Cronicle 설치
cd cronicle
./install-cronicle.sh

# 2. Cronicle 초기화
sudo /opt/cronicle/bin/control.sh setup

# 3. Cronicle 시작
sudo /opt/cronicle/bin/control.sh start

# 4. 웹 UI 접속
# http://localhost:3012/
# 계정: admin / admin

# 5. Notion 작업 등록
./register-notion-job.sh
```

**nvm 사용자:**
```bash
# 1. Cronicle 수동 설치
cd cronicle
./install-cronicle-manual.sh

# 2. 초기화
sudo /opt/cronicle/bin/control.sh setup

# 3. 시작 (편의 스크립트)
./cronicle-start.sh

# 4. 웹 UI 접속
# http://localhost:3012/
# 계정: admin / admin

# 5. Notion 작업 등록
./register-notion-job.sh
```

**자세한 가이드:** 
- [cronicle/CRONICLE_MIGRATION.md](./cronicle/CRONICLE_MIGRATION.md) - 상세 마이그레이션
- [cronicle/NVM_INSTALL_GUIDE.md](./cronicle/NVM_INSTALL_GUIDE.md) - nvm 사용자 가이드

### cron/launchd 사용 (레거시)

**macOS (launchd):**
```bash
./install-launchd.sh
```

**Linux (cron):**
```bash
crontab -e
# 0 */5 * * * /path/to/notion-cron-job.sh >> /path/to/logs/cron.log 2>&1
```

**자세한 가이드:** [README-cron.md](./README-cron.md)

## 📂 프로젝트 구조

```
dailyagent/
├── README.md                        # 이 파일
├── notion-cron-job.sh              # 메인 실행 스크립트 (레거시)
├── claude-automation-settings.json # Claude 권한 설정
├── crontab-ui.json                 # Cron 작업 설정 (레거시)
│
├── cronicle/                       # Cronicle 관련 파일 (권장)
│   ├── README.md                   # Cronicle 빠른 시작
│   ├── CRONICLE_MIGRATION.md       # 상세 마이그레이션 가이드
│   ├── PLUGIN_COMPARISON.md        # 플러그인 구현 방식 비교
│   ├── CHANGELOG.md                # 변경 이력
│   ├── install-cronicle.sh         # Cronicle 설치 스크립트
│   ├── setup-cronicle-service.sh   # systemd 서비스 설정
│   ├── register-notion-job.sh      # Notion 작업 등록
│   ├── cronicle-config.json        # Cronicle 설정
│   └── plugins/
│       └── notion-automation.js    # Notion 자동화 Wrapper 플러그인
│
├── logs/                           # 로그 디렉토리
│   ├── cron.log                    # Cron 실행 로그
│   ├── notion-cron-*.log           # 각 실행별 상세 로그
│   └── notion-result-*.json        # 작업 결과 JSON
│
└── docs/                           # 문서 (레거시)
    ├── README-cron.md              # Cron 설정 가이드
    ├── README-settings.md          # 설정 가이드
    ├── QUICKSTART.md               # 빠른 시작 가이드
    └── NOTION_AUTOMATION_README.md # Notion 자동화 상세 가이드
```

## ⚙️ 사전 요구사항

### 필수 요구사항

- [x] **Node.js** (LTS 버전) - Cronicle 실행용
- [x] **Claude Code CLI** - AI 기반 작업 수행
- [x] **Git** - 버전 관리
- [x] **Notion API 접근** - MCP 서버 설정

### 설치 확인

```bash
# Node.js 확인
node -v  # v18.0.0 이상
npm -v

# Claude Code CLI 확인
claude --version

# Git 확인
git --version

# MCP 서버 확인
ls -la ~/.cursor/projects/*/mcps/user-Notion/
```

### ⚠️ nvm 사용자 주의사항

Node.js를 **nvm**으로 설치한 경우:
- [cronicle/NVM_INSTALL_GUIDE.md](./cronicle/NVM_INSTALL_GUIDE.md) 참조
- `install-cronicle-manual.sh` 사용 권장
- 편의 스크립트 자동 생성 (`cronicle-start.sh` 등)

## 🔧 설정

### 1. Claude 자동화 설정

`claude-automation-settings.json` 파일에서 권한 설정:

```json
{
  "allowedTools": [
    "Shell(...)",
    "Read(...)",
    "Write(...)",
    "CallMcpTool(notion, *)",
    "CallMcpTool(user-Notion, *)"
  ]
}
```

### 2. Notion 데이터베이스

필수 속성:
- **제목** (Title): 작업 제목
- **상태** (Select): "작업 대기", "진행 중", "완료", "에러"
- **기준 브랜치** (Text): Git 기준 브랜치 (예: main, develop)
- **우선순위** (Number): 높을수록 우선
- **작업 브랜치** (Text): 생성된 브랜치명 (자동 입력)

데이터베이스 URL:
```
https://www.notion.so/[workspace]/[database_id]?v=[view_id]
```

### 3. 작업 디렉토리

Git 저장소가 설정된 디렉토리:
```bash
# 기본 경로
~/dev/web-temp/

# Git 저장소 확인
cd ~/dev/web-temp
git status
```

## 📊 모니터링

### Cronicle 웹 UI

```
http://localhost:3012/
```

- **Schedule**: 예약된 작업 목록
- **Live Jobs**: 현재 실행 중인 작업
- **Completed Jobs**: 완료된 작업 히스토리
- **Event History**: 모든 이벤트 기록

### 로그 확인

```bash
# Cronicle 로그
tail -f /opt/cronicle/logs/cronicle.log

# systemd 로그 (서비스로 실행 시)
sudo journalctl -u cronicle -f

# 작업 결과 로그
ls -t logs/notion-result-*.json | head -1 | xargs cat | jq .

# 레거시 cron 로그
tail -f logs/cron.log
```

## 🔄 작업 흐름

```
┌─────────────────────────────────────────┐
│  스케줄러 (Cronicle/Cron)               │
│  - 5시간마다 실행                       │
│  - 또는 특정 시간 실행                  │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Notion DB 조회                         │
│  - "작업 대기" 상태 필터링              │
│  - 우선순위 정렬                        │
│  - 작업 1개 선택                        │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Git 준비                               │
│  - 기준 브랜치로 전환                   │
│  - 최신 코드 pull                       │
│  - 새 브랜치 생성                       │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Claude Code 실행                       │
│  - 작업 내용 분석                       │
│  - 코드 작성/수정                       │
│  - 커밋 생성                            │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Git Push                               │
│  - 원격 저장소에 푸시                   │
│  - 브랜치 URL 획득                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│  Notion 업데이트                        │
│  - 상태: "작업 대기" → "검토 전"       │
│  - 작업 브랜치, 커밋 정보 기록          │
│  - 작업 요약 추가                       │
└─────────────────────────────────────────┘
```

## 🎨 Cronicle vs Cron 비교

| 기능 | Cronicle | Cron/launchd |
|------|----------|--------------|
| 웹 UI | ✅ | ❌ |
| 실시간 로그 | ✅ | ❌ |
| 작업 히스토리 | ✅ | ❌ (수동 관리) |
| 이메일 알림 | ✅ (내장) | ❌ (별도 설정) |
| 수동 실행 | ✅ (클릭) | ⚠️ (명령어) |
| 작업 일시 중지 | ✅ | ⚠️ (주석 처리) |
| 멀티 서버 | ✅ | ❌ |
| 작업 체인 | ✅ | ❌ |
| 설정 복잡도 | ⚠️ 중간 | ✅ 간단 |
| 리소스 사용 | ⚠️ 약간 높음 | ✅ 낮음 |

## 🔔 알림 설정

### Cronicle 이메일 알림

1. **My Account** > **Edit**
2. **Email** 입력
3. 작업 설정에서 알림 대상 설정

### Slack 웹훅

작업 설정 > **Web Hook**:
```
https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### macOS 알림 (cron 사용 시)

`notion-cron-job.sh` 끝에 추가:
```bash
osascript -e 'display notification "작업 완료" with title "Notion 자동화"'
```

## 🔒 보안 주의사항

1. **민감한 정보 보호**
   - API 키, 토큰은 환경 변수 또는 별도 파일에 저장
   - `.gitignore`에 민감한 파일 추가

2. **Git 저장소 보안**
   - Private 저장소 사용
   - SSH 키 설정 (비밀번호 없이 push)

3. **Cronicle 보안**
   - 초기 비밀번호(admin/admin) 즉시 변경
   - API 키 권한 최소화
   - HTTPS 설정 (프로덕션 환경)

## 📖 문서

- [Cronicle 마이그레이션 가이드](./cronicle/CRONICLE_MIGRATION.md) - 상세 마이그레이션 절차
- [Cronicle 빠른 시작](./cronicle/README.md) - Cronicle 기본 사용법
- [Cron 설정 가이드](./README-cron.md) - 레거시 cron 설정
- [Notion 자동화 가이드](./NOTION_AUTOMATION_README.md) - 작업 상세 설명
- [빠른 시작 가이드](./QUICKSTART.md) - 처음 시작하기

## 🛠️ 문제 해결

### Cronicle 관련

**"NPM cannot be found" 오류 (nvm 사용자):**
```bash
# 수동 설치 스크립트 사용
cd cronicle
./install-cronicle-manual.sh
```

**자세한 해결 방법:** [cronicle/NVM_INSTALL_GUIDE.md](./cronicle/NVM_INSTALL_GUIDE.md)

**Cronicle이 시작되지 않음:**
```bash
# 로그 확인
tail -f /opt/cronicle/logs/cronicle.log

# 포트 충돌 확인
sudo netstat -tulpn | grep 3012

# nvm 사용자: PATH 지정
NODE_DIR=$(dirname $(which node))
sudo env "PATH=$NODE_DIR:$PATH" /opt/cronicle/bin/control.sh start

# 또는 편의 스크립트 사용
cd cronicle
./cronicle-start.sh
```

**작업이 실행되지 않음:**
- 웹 UI에서 작업 Enabled 상태 확인
- Schedule 설정 확인
- Servers 메뉴에서 서버 활성 상태 확인

### Cron 관련

**Cron이 실행되지 않음:**
```bash
# Cron 설정 확인
crontab -l

# Cron 로그 확인
grep CRON /var/log/syslog

# 스크립트 권한 확인
ls -la notion-cron-job.sh
chmod +x notion-cron-job.sh
```

### Claude Code 관련

**Claude 명령어를 찾을 수 없음:**
```bash
# 설치 확인
which claude

# PATH 확인
echo $PATH

# 재설치
curl -fsSL https://code.claude.ai/install.sh | sh
```

**MCP 연결 오류:**
```bash
# MCP 서버 확인
claude mcp list

# Notion MCP 재설정
claude mcp remove notion
claude mcp add notion
```

### Git 관련

**Push 권한 오류:**
```bash
# SSH 키 확인
ssh -T git@github.com

# SSH 에이전트에 키 추가
ssh-add ~/.ssh/id_ed25519
```

## 🚀 업그레이드 경로

### Cron → Cronicle 마이그레이션

1. Cronicle 설치 및 설정
2. Notion 작업 등록
3. 테스트 실행 확인
4. 기존 cron/launchd 작업 중지
5. Cronicle 모니터링 시작

**자세한 가이드:** [cronicle/CRONICLE_MIGRATION.md](./cronicle/CRONICLE_MIGRATION.md)

## 📝 변경 이력

### v2.0.0 (2026-02-13)
- ✨ Cronicle 지원 추가 (Wrapper 패턴)
- ✨ 웹 UI 기반 작업 관리
- ✨ 실시간 로그 스트리밍
- 🔄 플러그인 구조 개선 (독립 구현 → Wrapper)
- 🔧 코드 중복 제거 및 유지보수 간소화
- 📚 상세 마이그레이션 가이드 추가

### v1.0.0 (2026-02-10)
- ✨ 초기 릴리스
- ✨ Cron/launchd 기반 자동화
- ✨ Claude Code CLI 통합
- ✨ Notion MCP 연동

## 🤝 기여

이슈나 개선 제안은 GitHub Issues에 등록해주세요.

## 📄 라이선스

이 프로젝트는 개인 사용을 위해 작성되었습니다.

## 🔗 참고 링크

- [Cronicle 공식 GitHub](https://github.com/jhuckaby/Cronicle)
- [Cronicle 문서](https://github.com/jhuckaby/Cronicle/blob/master/docs/README.md)
- [Claude Code 문서](https://code.claude.com/docs)
- [Notion API](https://developers.notion.com/)
- [Cron 표현식 가이드](https://crontab.guru/)

---

**Happy Automating! 🚀**
