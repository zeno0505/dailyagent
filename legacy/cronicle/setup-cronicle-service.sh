#!/bin/bash

################################################################################
# Cronicle Systemd 서비스 설정 스크립트
#
# Cronicle을 systemd 서비스로 등록하여 시스템 부팅 시 자동 시작
################################################################################

set -euo pipefail

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="/opt/cronicle"
SERVICE_FILE="/etc/systemd/system/cronicle.service"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cronicle Systemd 서비스 설정${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Cronicle 설치 확인
if [ ! -d "$INSTALL_DIR" ]; then
    echo -e "${RED}✗ Cronicle이 설치되어 있지 않습니다${NC}"
    echo -e "${YELLOW}먼저 install-cronicle.sh를 실행해주세요${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Cronicle 설치 확인${NC}"

# systemd 지원 확인
if ! command -v systemctl &> /dev/null; then
    echo -e "${RED}✗ systemd를 지원하지 않는 시스템입니다${NC}"
    exit 1
fi

echo -e "${GREEN}✓ systemd 지원 확인${NC}"
echo ""

# 기존 서비스 중지
if [ -f "$SERVICE_FILE" ]; then
    echo -e "${YELLOW}기존 Cronicle 서비스 중지 중...${NC}"
    sudo systemctl stop cronicle 2>/dev/null || true
    sudo systemctl disable cronicle 2>/dev/null || true
fi

# Systemd 서비스 파일 생성
echo -e "${YELLOW}Systemd 서비스 파일 생성 중...${NC}"

sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Cronicle Distributed Task Scheduler
Documentation=https://github.com/jhuckaby/Cronicle
After=network.target

[Service]
Type=forking
User=root
Group=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$INSTALL_DIR/bin/control.sh start
ExecStop=$INSTALL_DIR/bin/control.sh stop
ExecReload=$INSTALL_DIR/bin/control.sh restart
PIDFile=$INSTALL_DIR/logs/cronicle.pid
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

# 환경 변수
Environment="NODE_ENV=production"
Environment="PATH=/usr/local/bin:/usr/bin:/bin"

# 리소스 제한
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

echo -e "${GREEN}✓ 서비스 파일 생성 완료: $SERVICE_FILE${NC}"

# systemd 데몬 리로드
echo -e "${YELLOW}systemd 데몬 리로드 중...${NC}"
sudo systemctl daemon-reload
echo -e "${GREEN}✓ systemd 데몬 리로드 완료${NC}"

# 서비스 활성화
echo -e "${YELLOW}Cronicle 서비스 활성화 중...${NC}"
sudo systemctl enable cronicle
echo -e "${GREEN}✓ Cronicle 서비스 활성화 완료${NC}"

# 서비스 시작
echo -e "${YELLOW}Cronicle 서비스 시작 중...${NC}"
sudo systemctl start cronicle

# 잠시 대기
sleep 3

# 상태 확인
if sudo systemctl is-active --quiet cronicle; then
    echo -e "${GREEN}✓ Cronicle 서비스가 실행 중입니다${NC}"
else
    echo -e "${RED}✗ Cronicle 서비스 시작 실패${NC}"
    echo -e "${YELLOW}로그를 확인하세요:${NC}"
    echo -e "  ${BLUE}sudo journalctl -u cronicle -n 50${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Cronicle 서비스 설정 완료!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}서비스 관리 명령어:${NC}"
echo -e "  시작:        ${BLUE}sudo systemctl start cronicle${NC}"
echo -e "  중지:        ${BLUE}sudo systemctl stop cronicle${NC}"
echo -e "  재시작:      ${BLUE}sudo systemctl restart cronicle${NC}"
echo -e "  상태 확인:   ${BLUE}sudo systemctl status cronicle${NC}"
echo -e "  로그 확인:   ${BLUE}sudo journalctl -u cronicle -f${NC}"
echo -e "  자동 시작:   ${BLUE}sudo systemctl enable cronicle${NC}"
echo -e "  자동 시작 해제: ${BLUE}sudo systemctl disable cronicle${NC}"
echo ""
echo -e "${YELLOW}웹 UI 접속:${NC}"
echo -e "  ${BLUE}http://localhost:3012/${NC}"
echo -e "  초기 계정: admin / admin"
echo ""
