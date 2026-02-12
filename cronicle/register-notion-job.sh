#!/bin/bash

################################################################################
# Cronicle에 Notion 자동화 작업 등록 스크립트
#
# Cronicle API를 사용하여 Notion 자동화 작업을 등록합니다.
################################################################################

set -euo pipefail

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

CRONICLE_URL="http://localhost:3012"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_PATH="$SCRIPT_DIR/plugins/notion-automation.js"
NOTION_SCRIPT_PATH="$SCRIPT_DIR/../notion-cron-job.sh"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cronicle 작업 등록${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Cronicle 실행 확인
echo -e "${YELLOW}Cronicle 서버 확인 중...${NC}"
if ! curl -s -f "${CRONICLE_URL}/api/app/ping" > /dev/null; then
    echo -e "${RED}✗ Cronicle 서버에 연결할 수 없습니다${NC}"
    echo -e "${YELLOW}Cronicle이 실행 중인지 확인하세요:${NC}"
    echo -e "  ${BLUE}sudo systemctl status cronicle${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Cronicle 서버 연결 확인${NC}"

# 로그인 (API 키 필요)
echo ""
echo -e "${YELLOW}Cronicle 로그인이 필요합니다${NC}"
echo -e "${YELLOW}웹 UI(${CRONICLE_URL})에서 다음 작업을 수행하세요:${NC}"
echo ""
echo -e "1. 로그인 (admin/admin)"
echo -e "2. 상단 메뉴 > My Account"
echo -e "3. API Keys 탭"
echo -e "4. 'Create API Key' 클릭"
echo -e "5. Title: 'Notion Automation'"
echo -e "6. Privileges: 'Administrator' 선택"
echo -e "7. 'Create API Key' 버튼 클릭"
echo -e "8. 생성된 API 키를 복사"
echo ""
read -p "API 키를 입력하세요: " API_KEY

if [ -z "$API_KEY" ]; then
    echo -e "${RED}✗ API 키가 비어있습니다${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ API 키 입력 완료${NC}"

# 플러그인 설치
echo ""
echo -e "${YELLOW}플러그인 설치 중...${NC}"

PLUGIN_DEST="/opt/cronicle/plugins/notion-automation.js"
sudo mkdir -p /opt/cronicle/plugins
sudo cp "$PLUGIN_PATH" "$PLUGIN_DEST"
sudo chmod +x "$PLUGIN_DEST"

echo -e "${GREEN}✓ 플러그인 설치 완료: $PLUGIN_DEST${NC}"

# notion-cron-job.sh 실행 권한 확인
if [ ! -x "$NOTION_SCRIPT_PATH" ]; then
    echo -e "${YELLOW}⚠ notion-cron-job.sh에 실행 권한 부여 중...${NC}"
    chmod +x "$NOTION_SCRIPT_PATH"
    echo -e "${GREEN}✓ 실행 권한 부여 완료${NC}"
fi

# 카테고리 생성 (먼저 카테고리 ID 확인)
echo ""
echo -e "${YELLOW}카테고리 확인 중...${NC}"

CATEGORY_ID="cmljo166b03"
CATEGORY_RESPONSE=$(curl -s -X POST "${CRONICLE_URL}/api/app/create_category" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "id": "'$CATEGORY_ID'",
        "title": "Notion 자동화",
        "description": "Notion 데이터베이스 기반 작업 자동화",
        "enabled": 1,
        "max_concurrent": 1,
        "max_children": 0
    }' || echo '{"code": "already_exists"}')

if echo "$CATEGORY_RESPONSE" | grep -q '"code":0'; then
    echo -e "${GREEN}✓ 카테고리 생성 완료${NC}"
elif echo "$CATEGORY_RESPONSE" | grep -q 'already_exists'; then
    echo -e "${YELLOW}⚠ 카테고리가 이미 존재합니다${NC}"
else
    echo -e "${YELLOW}⚠ 카테고리 생성 응답: $CATEGORY_RESPONSE${NC}"
fi

# 플러그인 등록
echo ""
echo -e "${YELLOW}플러그인 등록 중...${NC}"

PLUGIN_ID="notion_automation"
PLUGIN_RESPONSE=$(curl -s -X POST "${CRONICLE_URL}/api/app/create_plugin" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "id": "'$PLUGIN_ID'",
        "title": "Notion 자동화 플러그인 (Wrapper)",
        "command": "node '$PLUGIN_DEST'",
        "params": [
            {
                "id": "script_path",
                "title": "스크립트 경로",
                "description": "실행할 notion-cron-job.sh 스크립트 경로",
                "type": "text",
                "value": "'$NOTION_SCRIPT_PATH'"
            }
        ]
    }' || echo '{"code": "already_exists"}')

if echo "$PLUGIN_RESPONSE" | grep -q '"code":0'; then
    echo -e "${GREEN}✓ 플러그인 등록 완료${NC}"
elif echo "$PLUGIN_RESPONSE" | grep -q 'already_exists'; then
    echo -e "${YELLOW}⚠ 플러그인이 이미 존재합니다${NC}"
else
    echo -e "${YELLOW}⚠ 플러그인 등록 응답: $PLUGIN_RESPONSE${NC}"
fi

# 이벤트(작업) 생성
echo ""
echo -e "${YELLOW}작업 생성 중...${NC}"

EVENT_RESPONSE=$(curl -s -X POST "${CRONICLE_URL}/api/app/create_event" \
    -H "X-API-Key: $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "title": "Notion 자동화 작업 (5시간마다)",
        "enabled": 1,
        "category": "'$CATEGORY_ID'",
        "plugin": "'$PLUGIN_ID'",
        "target": "allgrp",
        "timing": {
            "minutes": [0],
            "hours": [0, 5, 10, 15, 20]
        },
        "max_children": 1,
        "timeout": 7200,
        "catch_up": 0,
        "queue_max": 1,
        "timezone": "Asia/Seoul",
        "notes": "Notion 데이터베이스에서 작업 대기 상태의 작업을 가져와 자동으로 수행합니다.\n\n실행 시간: 0시, 5시, 10시, 15시, 20시 (5시간 간격)\n타임아웃: 2시간\n\n이 플러그인은 기존 notion-cron-job.sh 스크립트를 래핑하여 실행합니다.",
        "notify_success": "",
        "notify_fail": "admin",
        "web_hook": ""
    }')

if echo "$EVENT_RESPONSE" | grep -q '"code":0'; then
    EVENT_ID=$(echo "$EVENT_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    echo -e "${GREEN}✓ 작업 생성 완료 (ID: $EVENT_ID)${NC}"
else
    echo -e "${RED}✗ 작업 생성 실패${NC}"
    echo -e "${YELLOW}응답: $EVENT_RESPONSE${NC}"
    exit 1
fi

# API 키 저장
echo ""
echo -e "${YELLOW}API 키 저장 중...${NC}"
echo "$API_KEY" > "$SCRIPT_DIR/.cronicle-api-key"
chmod 600 "$SCRIPT_DIR/.cronicle-api-key"
echo -e "${GREEN}✓ API 키 저장 완료: $SCRIPT_DIR/.cronicle-api-key${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Cronicle 작업 등록 완료!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}다음 단계:${NC}"
echo ""
echo -e "1. 웹 UI에서 작업 확인:"
echo -e "   ${BLUE}${CRONICLE_URL}/#Schedule${NC}"
echo ""
echo -e "2. 수동으로 작업 실행 (테스트):"
echo -e "   웹 UI에서 작업 선택 > 'Run Now' 클릭"
echo ""
echo -e "3. 실시간 로그 확인:"
echo -e "   웹 UI에서 'Job Details' 클릭"
echo ""
echo -e "4. 기존 cron/launchd 작업 중지:"
echo -e "   ${BLUE}launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist${NC}"
echo -e "   또는"
echo -e "   ${BLUE}crontab -e${NC} (해당 줄 주석 처리)"
echo ""
