#!/bin/bash

################################################################################
# Cronicle 설치 스크립트
#
# Cronicle: Node.js 기반 분산 작업 스케줄러
# - 웹 UI로 작업 관리
# - 실시간 로그 확인
# - 작업 히스토리 추적
# - 이메일/웹훅 알림
# - 멀티 서버 지원
################################################################################

set -euo pipefail

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

INSTALL_DIR="/opt/cronicle"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR=""  # 재설치 시 설정될 변수

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cronicle 설치 시작${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Node.js 버전 확인
echo -e "${YELLOW}Node.js 버전 확인 중...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js가 설치되어 있지 않습니다${NC}"
    echo -e "${YELLOW}Node.js LTS 버전을 설치해주세요: https://nodejs.org/${NC}"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}✓ Node.js 버전: $NODE_VERSION${NC}"

# NPM 확인
if ! command -v npm &> /dev/null; then
    echo -e "${RED}✗ NPM이 설치되어 있지 않습니다${NC}"
    exit 1
fi

NPM_VERSION=$(npm -v)
echo -e "${GREEN}✓ NPM 버전: $NPM_VERSION${NC}"
echo ""

# 설치 디렉토리 권한 확인
echo -e "${YELLOW}설치 디렉토리 권한 확인 중...${NC}"
if [ -d "$INSTALL_DIR" ]; then
    echo -e "${YELLOW}⚠ Cronicle이 이미 설치되어 있습니다: $INSTALL_DIR${NC}"
    read -p "재설치하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}설치를 취소했습니다${NC}"
        exit 0
    fi
    
    # 기존 서비스 중지
    echo -e "${YELLOW}기존 Cronicle 서비스 중지 중...${NC}"
    sudo "$INSTALL_DIR/bin/control.sh" stop 2>/dev/null || true
    
    # 백업
    BACKUP_DIR="$INSTALL_DIR.backup.$(date +%Y%m%d-%H%M%S)"
    echo -e "${YELLOW}기존 설치를 백업 중: $BACKUP_DIR${NC}"
    sudo mv "$INSTALL_DIR" "$BACKUP_DIR"
fi

# Cronicle 설치
echo ""
echo -e "${YELLOW}Cronicle 설치 중...${NC}"
echo -e "${BLUE}설치 위치: $INSTALL_DIR${NC}"
echo ""

# Node 및 NPM 경로 확인
NODE_BIN=$(which node)
NPM_BIN=$(which npm)
NODE_DIR=$(dirname "$NODE_BIN")

echo -e "${YELLOW}Node 경로: $NODE_BIN${NC}"
echo -e "${YELLOW}NPM 경로: $NPM_BIN${NC}"
echo ""

# nvm 사용 여부 확인
if [[ "$NODE_BIN" == *".nvm"* ]]; then
    echo -e "${YELLOW}⚠ nvm을 사용 중입니다. 수동 설치 방법을 사용합니다.${NC}"
    echo ""
    
    # 수동 설치
    echo -e "${YELLOW}Cronicle 다운로드 중...${NC}"
    sudo mkdir -p "$INSTALL_DIR"
    
    # 최신 릴리스 버전 가져오기
    LATEST_VERSION=$(curl -s https://api.github.com/repos/jhuckaby/Cronicle/releases/latest | grep '"tag_name"' | sed -E 's/.*"v([^"]+)".*/\1/')
    
    if [ -z "$LATEST_VERSION" ]; then
        echo -e "${YELLOW}최신 버전을 가져올 수 없습니다. v1.0.0을 사용합니다.${NC}"
        LATEST_VERSION="1.0.0"
    fi
    
    echo -e "${BLUE}버전: v$LATEST_VERSION${NC}"
    
    cd /tmp
    curl -L "https://github.com/jhuckaby/Cronicle/archive/v${LATEST_VERSION}.tar.gz" -o cronicle.tar.gz
    
    # 압축 해제
    echo -e "${YELLOW}압축 해제 중...${NC}"
    sudo tar -xzf cronicle.tar.gz -C "$INSTALL_DIR" --strip-components=1
    
    # npm install (PATH 전달)
    echo -e "${YELLOW}의존성 설치 중... (시간이 걸릴 수 있습니다)${NC}"
    cd "$INSTALL_DIR"
    sudo env "PATH=$NODE_DIR:$PATH" npm install
    
    # 빌드
    echo -e "${YELLOW}빌드 중...${NC}"
    sudo env "PATH=$NODE_DIR:$PATH" node bin/build.js dist
    
    # 정리
    rm -f /tmp/cronicle.tar.gz
    
else
    # 자동 설치 스크립트 실행
    echo -e "${YELLOW}자동 설치 스크립트 실행 중...${NC}"
    curl -s https://raw.githubusercontent.com/jhuckaby/Cronicle/master/bin/install.js | sudo env "PATH=$NODE_DIR:$PATH" node
fi

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Cronicle 설치 실패${NC}"
    echo -e "${YELLOW}로그를 확인하세요${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Cronicle 설치 완료${NC}"

# 설정 파일 복사
echo ""
echo -e "${YELLOW}Cronicle 설정 중...${NC}"

# 백업에서 설정 복원 (재설치인 경우)
if [ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]; then
    echo -e "${YELLOW}기존 설정 복원 중...${NC}"
    sudo cp -p "$BACKUP_DIR/conf/config.json" "$INSTALL_DIR/conf/config.json.backup"
    echo -e "${GREEN}✓ 기존 설정을 config.json.backup으로 저장했습니다${NC}"
fi

# 커스텀 설정 적용
if [ -f "$SCRIPT_DIR/cronicle-config.json" ]; then
    echo -e "${YELLOW}커스텀 설정 적용 중...${NC}"
    sudo cp "$SCRIPT_DIR/cronicle-config.json" "$INSTALL_DIR/conf/config.json"
    echo -e "${GREEN}✓ 커스텀 설정 적용 완료${NC}"
else
    echo -e "${YELLOW}⚠ 커스텀 설정 파일이 없습니다. 기본 설정을 사용합니다${NC}"
    echo -e "${YELLOW}  설정 파일: $INSTALL_DIR/conf/config.json${NC}"
fi

# 권한 설정
echo -e "${YELLOW}권한 설정 중...${NC}"
sudo chown -R $USER:$(id -gn) "$INSTALL_DIR"
echo -e "${GREEN}✓ 권한 설정 완료${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Cronicle 설치 완료!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}다음 단계:${NC}"
echo ""
echo -e "1. 설정 파일 편집 (필요한 경우):"
echo -e "   ${BLUE}sudo nano $INSTALL_DIR/conf/config.json${NC}"
echo ""
echo -e "2. Cronicle 초기화 (최초 1회만):"
echo -e "   ${BLUE}sudo $INSTALL_DIR/bin/control.sh setup${NC}"
echo ""
echo -e "3. Cronicle 시작:"
echo -e "   ${BLUE}sudo $INSTALL_DIR/bin/control.sh start${NC}"
echo ""
echo -e "4. 웹 UI 접속:"
echo -e "   ${BLUE}http://localhost:3012/${NC}"
echo -e "   초기 계정: admin / admin"
echo ""
echo -e "5. 자동 시작 설정 (systemd):"
echo -e "   ${BLUE}$SCRIPT_DIR/setup-cronicle-service.sh${NC}"
echo ""
echo -e "${YELLOW}주요 명령어:${NC}"
echo -e "  시작:    ${BLUE}sudo $INSTALL_DIR/bin/control.sh start${NC}"
echo -e "  중지:    ${BLUE}sudo $INSTALL_DIR/bin/control.sh stop${NC}"
echo -e "  재시작:  ${BLUE}sudo $INSTALL_DIR/bin/control.sh restart${NC}"
echo -e "  상태:    ${BLUE}sudo $INSTALL_DIR/bin/control.sh status${NC}"
echo ""
