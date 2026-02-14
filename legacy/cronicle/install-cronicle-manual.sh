#!/bin/bash

################################################################################
# Cronicle 수동 설치 스크립트 (nvm 사용자용)
#
# nvm을 사용하는 경우 sudo 환경에서 npm을 찾지 못하므로
# 수동으로 설치하는 방법입니다.
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
VERSION="${1:-1.0.0}"
BACKUP_DIR=""  # 재설치 시 설정될 변수

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cronicle 수동 설치 (nvm 사용자용)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Node.js 및 NPM 경로 확인
NODE_BIN=$(which node)
NPM_BIN=$(which npm)
NODE_DIR=$(dirname "$NODE_BIN")

echo -e "${GREEN}✓ Node.js: $NODE_BIN${NC}"
echo -e "${GREEN}✓ NPM: $NPM_BIN${NC}"
echo -e "${GREEN}✓ Node 디렉토리: $NODE_DIR${NC}"
echo ""

# 기존 설치 확인
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

# 설치 디렉토리 생성
echo -e "${YELLOW}설치 디렉토리 생성 중...${NC}"
sudo mkdir -p "$INSTALL_DIR"

# Cronicle 다운로드
echo ""
echo -e "${YELLOW}Cronicle v${VERSION} 다운로드 중...${NC}"
cd /tmp
curl -L "https://github.com/jhuckaby/Cronicle/archive/v${VERSION}.tar.gz" -o cronicle.tar.gz

if [ ! -f cronicle.tar.gz ]; then
    echo -e "${RED}✗ 다운로드 실패${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 다운로드 완료${NC}"

# 압축 해제
echo -e "${YELLOW}압축 해제 중...${NC}"
sudo tar -xzf cronicle.tar.gz -C "$INSTALL_DIR" --strip-components=1

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ 압축 해제 실패${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 압축 해제 완료${NC}"

# 의존성 설치
echo ""
echo -e "${YELLOW}의존성 설치 중... (시간이 걸릴 수 있습니다)${NC}"
cd "$INSTALL_DIR"

# sudo 환경에 PATH 전달하여 npm 실행
sudo env "PATH=$NODE_DIR:$PATH" npm install

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ 의존성 설치 실패${NC}"
    echo -e "${YELLOW}다음 명령으로 수동 설치를 시도하세요:${NC}"
    echo -e "  ${BLUE}cd $INSTALL_DIR && sudo env \"PATH=$NODE_DIR:\$PATH\" npm install${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 의존성 설치 완료${NC}"

# 빌드
echo ""
echo -e "${YELLOW}빌드 중...${NC}"
sudo env "PATH=$NODE_DIR:$PATH" node bin/build.js dist

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ 빌드 실패${NC}"
    exit 1
fi

echo -e "${GREEN}✓ 빌드 완료${NC}"

# 정리
echo -e "${YELLOW}임시 파일 정리 중...${NC}"
rm -f /tmp/cronicle.tar.gz

# 설정 파일 복사
if [ -f "$SCRIPT_DIR/cronicle-config.json" ]; then
    echo -e "${YELLOW}커스텀 설정 적용 중...${NC}"
    sudo cp "$SCRIPT_DIR/cronicle-config.json" "$INSTALL_DIR/conf/config.json"
    echo -e "${GREEN}✓ 커스텀 설정 적용 완료${NC}"
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
echo -e "1. Cronicle 초기화 (최초 1회만):"
echo -e "   ${BLUE}sudo $INSTALL_DIR/bin/control.sh setup${NC}"
echo ""
echo -e "2. Cronicle 시작:"
echo -e "   ${BLUE}sudo env \"PATH=$NODE_DIR:\$PATH\" $INSTALL_DIR/bin/control.sh start${NC}"
echo ""
echo -e "   또는 간단하게:"
echo -e "   ${BLUE}$SCRIPT_DIR/cronicle-start.sh${NC}"
echo ""
echo -e "3. 웹 UI 접속:"
echo -e "   ${BLUE}http://localhost:3012/${NC}"
echo -e "   초기 계정: admin / admin"
echo ""

# 편의 스크립트 생성
cat > "$SCRIPT_DIR/cronicle-start.sh" <<EOF
#!/bin/bash
NODE_DIR="$NODE_DIR"
sudo env "PATH=\$NODE_DIR:\$PATH" $INSTALL_DIR/bin/control.sh start
EOF

cat > "$SCRIPT_DIR/cronicle-stop.sh" <<EOF
#!/bin/bash
NODE_DIR="$NODE_DIR"
sudo env "PATH=\$NODE_DIR:\$PATH" $INSTALL_DIR/bin/control.sh stop
EOF

cat > "$SCRIPT_DIR/cronicle-restart.sh" <<EOF
#!/bin/bash
NODE_DIR="$NODE_DIR"
sudo env "PATH=\$NODE_DIR:\$PATH" $INSTALL_DIR/bin/control.sh restart
EOF

cat > "$SCRIPT_DIR/cronicle-status.sh" <<EOF
#!/bin/bash
NODE_DIR="$NODE_DIR"
sudo env "PATH=\$NODE_DIR:\$PATH" $INSTALL_DIR/bin/control.sh status
EOF

chmod +x "$SCRIPT_DIR/cronicle-"*.sh

echo -e "${GREEN}✓ 편의 스크립트 생성 완료${NC}"
echo -e "   - ${BLUE}./cronicle-start.sh${NC} - Cronicle 시작"
echo -e "   - ${BLUE}./cronicle-stop.sh${NC} - Cronicle 중지"
echo -e "   - ${BLUE}./cronicle-restart.sh${NC} - Cronicle 재시작"
echo -e "   - ${BLUE}./cronicle-status.sh${NC} - 상태 확인"
echo ""
