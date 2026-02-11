# Notion 자동화 실행 설정 가이드

## 개요

이 스크립트는 5시간마다 자동으로:
1. Notion 데이터베이스에서 "시작 전" 상태의 작업을 조회
2. 가장 우선순위가 높은 작업 하나를 선택
3. `~/dev/web-temp/` 에서 해당 작업을 수행
4. Git 브랜치를 생성하고 커밋/푸시
5. 작업 결과를 Notion에 업데이트

## 사전 요구사항

- [x] Claude Code CLI 설치 (`claude --version`으로 확인)
- [x] `~/dev/web-temp/` 가 Git 저장소로 설정되어 있어야 함
- [x] Notion MCP 서버가 설정되어 있어야 함
- [x] Git 원격 저장소 접근 권한 (push 가능)
- [x] Git SSH 키 설정 (비밀번호 없이 push 가능하도록)

## 권한 설정

자동화 실행을 위해서는 **권한 프롬프트 자동 승인**이 필요합니다.

### 방법 1: 설정 파일 사용 (권장)

`claude-automation-settings.json` 파일이 자동 생성되어 있습니다. 이 파일은:
- ✅ 필요한 도구만 허용
- ✅ 위험한 명령 차단
- ✅ 안전하고 제어 가능

### 방법 2: 모든 권한 자동 승인

설정 파일과 함께 `--dangerously-skip-permissions` 플래그를 사용합니다.
- ✅ MCP 도구 호출 시 추가 권한 자동 승인
- ✅ 설정 파일로 기본 도구는 제어하되, MCP는 자유롭게 사용
- ⚠️ 신뢰할 수 있는 Notion 데이터만 사용할 것

### Notion MCP 테스트

Notion 연결을 테스트하려면:

```bash
./test-notion-mcp.sh
```

이 스크립트는:
- Notion MCP 서버 설치 확인
- 데이터베이스 조회 테스트
- 권한 설정 확인
- 실제 Notion API 호출 테스트

### Git SSH 키 설정

비밀번호 프롬프트 없이 push하려면:

```bash
# SSH 키 생성 (없는 경우)
ssh-keygen -t ed25519 -C "your_email@example.com"

# macOS Keychain에 키 추가 (비밀번호 저장)
ssh-add --apple-use-keychain ~/.ssh/id_ed25519

# ~/.ssh/config 파일 설정
cat >> ~/.ssh/config << EOF
Host github.com
  AddKeysToAgent yes
  UseKeychain yes
  IdentityFile ~/.ssh/id_ed25519
EOF

# GitHub에 SSH 키 등록
cat ~/.ssh/id_ed25519.pub
# 출력된 키를 https://github.com/settings/keys 에 추가
```

## 스크립트 파일

- **메인 스크립트:** `/Users/fanding/scripts/notion-cron-job.sh`
- **로그 디렉토리:** `/Users/fanding/scripts/logs/`
- **로그 파일 형식:** `notion-cron-YYYY-MM-DD_HH-MM-SS.log`
- **결과 파일 형식:** `notion-result-YYYY-MM-DD_HH-MM-SS.json`

## 자동 실행 설정

### ⭐ 방법 1: launchd (권장 - macOS 네이티브)

macOS에서는 launchd가 cron보다 권장됩니다.

#### 장점
- ✅ macOS에 최적화되어 있음
- ✅ 환경 변수 관리가 쉬움
- ✅ 로그 관리가 편리함
- ✅ 시스템 절전 모드에서 깨어나서 실행 가능
- ✅ 실행 실패 시 자동 재시도

#### 설치

```bash
cd /Users/fanding/scripts
./install-launchd.sh
```

#### 상태 확인

```bash
# LaunchAgent 상태 확인
launchctl list | grep com.fanding.notion-cron

# 로그 실시간 확인
tail -f ~/scripts/logs/launchd-stdout.log
```

#### 관리 명령어

```bash
# 수동 실행 (테스트용)
launchctl start com.fanding.notion-cron

# 중지
launchctl stop com.fanding.notion-cron

# 언로드 (비활성화)
launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist

# 재로드 (설정 변경 후)
launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist
launchctl load ~/Library/LaunchAgents/com.fanding.notion-cron.plist
```

#### 제거

```bash
cd /Users/fanding/scripts
./uninstall-launchd.sh
```

#### 실행 시간 변경

`com.fanding.notion-cron.plist` 파일을 편집:

**5시간마다 실행 (현재 설정):**
```xml
<key>StartInterval</key>
<integer>18000</integer>
```

**특정 시간에 실행 (예: 9시, 14시, 19시, 0시, 5시):**
```xml
<!-- StartInterval 줄을 삭제하고 아래로 교체 -->
<key>StartCalendarInterval</key>
<array>
    <dict>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <dict>
        <key>Hour</key>
        <integer>14</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <!-- 추가 시간대... -->
</array>
```

변경 후 재로드:
```bash
launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist
launchctl load ~/Library/LaunchAgents/com.fanding.notion-cron.plist
```

### 방법 2: Cron (대안)

### 1. Crontab 편집

```bash
crontab -e
```

### 2. Cron Job 추가

**옵션 A: 5시간마다 실행 (매시간 0분)**
```cron
0 */5 * * * /Users/fanding/scripts/notion-cron-job.sh >> /Users/fanding/scripts/logs/cron-main.log 2>&1
```

**옵션 B: 특정 시간에 실행 (오전 9시, 오후 2시, 오후 7시, 자정, 오전 5시)**
```cron
0 9,14,19,0,5 * * * /Users/fanding/scripts/notion-cron-job.sh >> /Users/fanding/scripts/logs/cron-main.log 2>&1
```

**옵션 C: 평일 업무 시간에만 실행 (오전 9시, 오후 2시, 오후 7시)**
```cron
0 9,14,19 * * 1-5 /Users/fanding/scripts/notion-cron-job.sh >> /Users/fanding/scripts/logs/cron-main.log 2>&1
```

### 3. Cron 설정 확인

```bash
crontab -l
```

## 수동 테스트

Cron 설정 전에 스크립트를 수동으로 테스트:

```bash
# 직접 실행
/Users/fanding/scripts/notion-cron-job.sh

# 또는 작업 디렉토리에서 실행
cd ~/dev/web-temp
/Users/fanding/scripts/notion-cron-job.sh
```

## 로그 확인

### 최신 작업 로그 확인

```bash
# 가장 최근 로그 파일 보기
ls -t ~/scripts/logs/notion-cron-*.log | head -1 | xargs cat

# 또는 tail로 실시간 확인
tail -f ~/scripts/logs/cron-main.log
```

### 특정 날짜의 로그 확인

```bash
# 2026년 2월 10일의 로그
ls ~/scripts/logs/notion-cron-2026-02-10*.log
cat ~/scripts/logs/notion-cron-2026-02-10_14-00-00.log
```

### 결과 JSON 확인

```bash
# 최신 결과
ls -t ~/scripts/logs/notion-result-*.json | head -1 | xargs cat | jq .

# 성공한 작업만 확인
ls ~/scripts/logs/notion-result-*.json | xargs grep '"success": true'
```

## 문제 해결

### launchd 관련

#### 1. LaunchAgent가 시작되지 않음

```bash
# 로그 확인
cat ~/scripts/logs/launchd-stderr.log

# plist 파일 유효성 검증
plutil -lint ~/Library/LaunchAgents/com.fanding.notion-cron.plist

# 수동으로 언로드 후 재로드
launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist
launchctl load ~/Library/LaunchAgents/com.fanding.notion-cron.plist
```

#### 2. 환경 변수 문제

launchd는 별도의 환경에서 실행되므로 PATH 설정이 중요합니다.

`com.fanding.notion-cron.plist`의 `EnvironmentVariables` 섹션 확인:

```xml
<key>EnvironmentVariables</key>
<dict>
    <key>PATH</key>
    <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:/Users/fanding/.local/bin</string>
</dict>
```

Claude 설치 경로 확인:
```bash
which claude
# 결과를 PATH에 추가
```

#### 3. 권한 문제

```bash
# plist 파일 권한 확인
ls -la ~/Library/LaunchAgents/com.fanding.notion-cron.plist
# 644 권한이어야 함

# 권한 수정
chmod 644 ~/Library/LaunchAgents/com.fanding.notion-cron.plist
```

### 공통 문제

#### 1. Claude Code가 실행되지 않음

```bash
# Claude Code 설치 확인
which claude
claude --version

# PATH 확인
echo $PATH
```

#### 2. Git Push 권한 오류

```bash
# SSH 키 확인
ssh -T git@github.com

# Cron에서 SSH 에이전트 사용 (필요한 경우)
# eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_rsa
```

#### 3. Notion MCP 연결 오류

```bash
# MCP 서버 상태 확인
claude mcp list

# Notion MCP 서버가 있는지 확인
claude mcp list | grep Notion

# Notion MCP 재설정
claude mcp add notion

# MCP 서버 재시작
claude mcp restart
```

**권한 오류인 경우:**

1. MCP 서버 이름 확인:
```bash
claude mcp list | grep -i notion
# 출력 예: notion: https://mcp.notion.com/mcp (HTTP) - ✓ Connected
```

2. `claude-automation-settings.json`에 해당 서버 이름의 MCP 도구가 포함되어 있는지 확인:
```bash
cat claude-automation-settings.json | grep "CallMcpTool(notion"
```

3. 없다면 파일을 삭제하고 다시 생성:
```bash
rm claude-automation-settings.json
# 스크립트를 다시 받아서 최신 설정 파일 사용
```

4. 또는 수동으로 추가 (MCP 서버 이름에 맞게 `notion` 또는 `user-Notion` 사용):
```json
"allowedTools": [
  ...
  "CallMcpTool(notion, *)",
  "CallMcpTool(notion, notion-query-database-view)",
  "CallMcpTool(notion, notion-fetch)",
  "CallMcpTool(notion, notion-update-page)",
  "CallMcpTool(user-Notion, *)",
  "CallMcpTool(user-Notion, notion-query-database-view)",
  "CallMcpTool(user-Notion, notion-fetch)",
  "CallMcpTool(user-Notion, notion-update-page)"
]
```

**참고**: 설정 파일은 `notion`과 `user-Notion` 두 가지 서버 이름을 모두 포함하므로 어떤 환경에서도 작동합니다.

**Notion API 인증 오류인 경우:**

```bash
# Notion 통합(Integration) 설정 확인
# 1. https://www.notion.so/my-integrations 접속
# 2. 통합 키(API Key) 확인
# 3. 워크스페이스에서 데이터베이스 공유 확인

# MCP 서버 재설정으로 인증 정보 갱신
claude mcp remove notion
claude mcp add notion
```

#### 4. 작업 디렉토리 권한 문제

```bash
# 디렉토리 권한 확인
ls -la ~/dev/web-temp

# Git 저장소 상태 확인
cd ~/dev/web-temp
git status
```

## 일시 중지/재개/제거

### launchd 사용 시

```bash
# 일시 중지
launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist

# 재개
launchctl load ~/Library/LaunchAgents/com.fanding.notion-cron.plist

# 완전 제거
./uninstall-launchd.sh
```

### Cron 사용 시

```bash
# 일시 중지
crontab -e
# 해당 줄 앞에 # 추가

# 재개
crontab -e
# # 제거

# 완전 제거
crontab -e
# 해당 줄 완전히 삭제
```

## 스크립트 동작 흐름

```
1. Cron이 스크립트 실행
   ↓
2. 로그 디렉토리 및 파일 생성
   ↓
3. 작업 디렉토리 및 Git 저장소 확인
   ↓
4. Claude Code CLI 실행
   ├─ Notion에서 "시작 전" 작업 조회
   ├─ 작업 내용 분석
   ├─ Git 브랜치 생성
   ├─ 작업 수행 및 커밋
   ├─ Git Push
   └─ Notion 업데이트
   ↓
5. 결과를 JSON 파일로 저장
   ↓
6. 로그 파일에 모든 과정 기록
```

## 알림 설정 (선택사항)

작업 완료 또는 에러 발생 시 알림을 받고 싶다면:

### macOS 알림

스크립트 끝에 추가:

```bash
# notion-cron-job.sh 끝에 추가
if [ $CLAUDE_EXIT_CODE -eq 0 ]; then
    osascript -e 'display notification "Notion 작업 자동화 완료" with title "Cron Job"'
else
    osascript -e 'display notification "Notion 작업 실패 (Exit Code: '$CLAUDE_EXIT_CODE')" with title "Cron Job Error"'
fi
```

### Slack 웹훅 (선택)

```bash
# Slack 웹훅 URL 설정
SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

# 메시지 전송
curl -X POST "$SLACK_WEBHOOK" \
  -H 'Content-Type: application/json' \
  -d '{
    "text": "Notion 자동화 작업 완료",
    "blocks": [
      {
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "*작업 결과:* 성공\n*브랜치:* '"$BRANCH_NAME"'"
        }
      }
    ]
  }'
```

## 보안 주의사항

1. **민감한 정보 보호**
   - API 키, 비밀번호 등은 환경 변수나 별도 설정 파일에 저장
   - 로그 파일 권한 설정: `chmod 600 ~/scripts/logs/*.log`

2. **Git 저장소 보안**
   - Private 저장소 사용 권장
   - `.gitignore`에 민감한 파일 추가

3. **Cron 환경 보안**
   - Crontab 파일 권한 확인
   - 실행 계정 최소 권한 원칙 적용

## 참고 자료

- [Claude Code CLI 문서](https://code.claude.com/docs/ko/cli-reference)
- [Cron 표현식 가이드](https://crontab.guru/)
- [Notion API 문서](https://developers.notion.com/)
