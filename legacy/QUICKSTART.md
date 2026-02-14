# 🚀 빠른 시작 가이드

## 0️⃣ 테스트 (선택사항, 권장)

```bash
cd /Users/fanding/scripts

# Claude Code 연결 테스트
./test-claude-connection.sh

# Notion MCP 연결 테스트
./test-notion-mcp.sh
```

Claude Code 설치 및 Notion MCP 연결을 확인합니다.

## 1️⃣ 설치 (1분)

```bash
cd /Users/fanding/scripts
./install-launchd.sh
```

완료! 이제 5시간마다 자동으로 실행됩니다.

## 2️⃣ 상태 확인

```bash
# LaunchAgent 실행 중인지 확인
launchctl list | grep com.fanding.notion-cron

# 로그 보기
tail -f ~/scripts/logs/launchd-stdout.log
```

## 3️⃣ 수동 테스트

```bash
# 지금 바로 실행해보기
launchctl start com.fanding.notion-cron

# 또는 스크립트 직접 실행
/Users/fanding/scripts/notion-cron-job.sh
```

## 4️⃣ 로그 확인

```bash
# 최신 작업 로그
ls -t ~/scripts/logs/notion-cron-*.log | head -1 | xargs cat

# 결과 JSON
ls -t ~/scripts/logs/notion-result-*.json | head -1 | xargs cat | jq .
```

## 5️⃣ 관리 명령어

```bash
# 중지
launchctl stop com.fanding.notion-cron

# 비활성화
launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist

# 재활성화
launchctl load ~/Library/LaunchAgents/com.fanding.notion-cron.plist

# 제거
./uninstall-launchd.sh
```

## ⚙️ 설정 변경

### 실행 간격 변경

`com.fanding.notion-cron.plist` 편집 후:

```bash
# 재로드
launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist
launchctl load ~/Library/LaunchAgents/com.fanding.notion-cron.plist
```

## 📚 자세한 문서

- 상세 가이드: `README-cron.md`
- 메인 스크립트: `notion-cron-job.sh`
- launchd 설정: `com.fanding.notion-cron.plist`

## ❓ 문제 해결

```bash
# 에러 로그 확인
cat ~/scripts/logs/launchd-stderr.log

# plist 파일 유효성 검증
plutil -lint ~/Library/LaunchAgents/com.fanding.notion-cron.plist

# Claude 경로 확인
which claude
```

문제가 계속되면 `README-cron.md`의 "문제 해결" 섹션을 참고하세요.
