#!/bin/bash

################################################################################
# Notion 자동화 LaunchAgent 설치 스크립트
#
# 이 스크립트는 notion-cron-job.sh를 macOS launchd로 실행하도록 설정합니다.
#
# 사용법:
#   ./install-launchd.sh
################################################################################

set -euo pipefail

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_SOURCE="$SCRIPT_DIR/com.fanding.notion-cron.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.fanding.notion-cron.plist"
LABEL="com.fanding.notion-cron"

echo "=========================================="
echo "Notion 자동화 LaunchAgent 설치"
echo "=========================================="
echo ""

# LaunchAgents 디렉토리 생성
if [ ! -d "$HOME/Library/LaunchAgents" ]; then
    echo -e "${YELLOW}LaunchAgents 디렉토리 생성 중...${NC}"
    mkdir -p "$HOME/Library/LaunchAgents"
fi

# 로그 디렉토리 생성
if [ ! -d "$SCRIPT_DIR/logs" ]; then
    echo -e "${YELLOW}로그 디렉토리 생성 중...${NC}"
    mkdir -p "$SCRIPT_DIR/logs"
fi

# 기존 작업이 로드되어 있는지 확인
if launchctl list | grep -q "$LABEL"; then
    echo -e "${YELLOW}기존 LaunchAgent 언로드 중...${NC}"
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    launchctl remove "$LABEL" 2>/dev/null || true
    sleep 1
fi

# plist 파일 복사
echo -e "${YELLOW}plist 파일 복사 중...${NC}"
cp "$PLIST_SOURCE" "$PLIST_DEST"

# 권한 설정
chmod 644 "$PLIST_DEST"

# plist 파일 유효성 검증
echo -e "${YELLOW}plist 파일 유효성 검증 중...${NC}"
if plutil -lint "$PLIST_DEST" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ plist 파일이 유효합니다${NC}"
else
    echo -e "${RED}✗ plist 파일이 유효하지 않습니다${NC}"
    plutil -lint "$PLIST_DEST"
    exit 1
fi

# LaunchAgent 로드
echo -e "${YELLOW}LaunchAgent 로드 중...${NC}"
if launchctl load "$PLIST_DEST" 2>&1; then
    echo -e "${GREEN}✓ LaunchAgent가 성공적으로 로드되었습니다${NC}"
else
    echo -e "${RED}✗ LaunchAgent 로드 실패${NC}"
    exit 1
fi

# 로드 확인
sleep 1
if launchctl list | grep -q "$LABEL"; then
    echo -e "${GREEN}✓ LaunchAgent가 실행 중입니다${NC}"
else
    echo -e "${RED}✗ LaunchAgent를 찾을 수 없습니다${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}설치 완료!${NC}"
echo "=========================================="
echo ""
echo "설정 정보:"
echo "  - Label: $LABEL"
echo "  - plist: $PLIST_DEST"
echo "  - 실행 간격: 5시간마다"
echo ""
echo "관리 명령어:"
echo "  상태 확인:  launchctl list | grep $LABEL"
echo "  로그 확인:  tail -f $SCRIPT_DIR/logs/launchd-stdout.log"
echo "  수동 실행:  launchctl start $LABEL"
echo "  중지:       launchctl stop $LABEL"
echo "  언로드:     launchctl unload $PLIST_DEST"
echo "  재로드:     launchctl unload $PLIST_DEST && launchctl load $PLIST_DEST"
echo ""
echo "제거 방법:"
echo "  ./uninstall-launchd.sh"
echo ""
