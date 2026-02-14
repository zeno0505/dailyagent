#!/bin/bash

################################################################################
# Notion 자동화 LaunchAgent 제거 스크립트
#
# 사용법:
#   ./uninstall-launchd.sh
################################################################################

set -euo pipefail

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PLIST_DEST="$HOME/Library/LaunchAgents/com.fanding.notion-cron.plist"
LABEL="com.fanding.notion-cron"

echo "=========================================="
echo "Notion 자동화 LaunchAgent 제거"
echo "=========================================="
echo ""

# LaunchAgent가 로드되어 있는지 확인
if launchctl list | grep -q "$LABEL"; then
    echo -e "${YELLOW}LaunchAgent 언로드 중...${NC}"
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    launchctl remove "$LABEL" 2>/dev/null || true
    echo -e "${GREEN}✓ LaunchAgent가 언로드되었습니다${NC}"
else
    echo -e "${YELLOW}LaunchAgent가 로드되어 있지 않습니다${NC}"
fi

# plist 파일 삭제
if [ -f "$PLIST_DEST" ]; then
    echo -e "${YELLOW}plist 파일 삭제 중...${NC}"
    rm -f "$PLIST_DEST"
    echo -e "${GREEN}✓ plist 파일이 삭제되었습니다${NC}"
else
    echo -e "${YELLOW}plist 파일이 존재하지 않습니다${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}제거 완료!${NC}"
echo "=========================================="
echo ""
echo "참고: 로그 파일은 삭제되지 않았습니다."
echo "로그 위치: $(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/logs/"
echo ""
