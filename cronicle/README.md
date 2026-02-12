# Cronicle 기반 Notion 자동화

이 디렉토리는 **Cronicle**을 사용하여 Notion 자동화 작업을 관리하는 파일들을 포함합니다.

## 📂 파일 구조

```
cronicle/
├── README.md                        # 이 파일
├── CRONICLE_MIGRATION.md           # 상세 마이그레이션 가이드
├── NVM_INSTALL_GUIDE.md            # nvm 사용자를 위한 설치 가이드
├── PLUGIN_COMPARISON.md            # 플러그인 구현 방식 비교
├── install-cronicle.sh             # Cronicle 자동 설치 스크립트
├── install-cronicle-manual.sh      # Cronicle 수동 설치 (nvm용)
├── setup-cronicle-service.sh       # systemd 서비스 설정
├── register-notion-job.sh          # Notion 작업 등록 스크립트
├── cronicle-config.json            # Cronicle 설정 파일
├── cronicle-start.sh               # Cronicle 시작 (자동 생성)
├── cronicle-stop.sh                # Cronicle 중지 (자동 생성)
├── cronicle-restart.sh             # Cronicle 재시작 (자동 생성)
├── cronicle-status.sh              # 상태 확인 (자동 생성)
└── plugins/
    └── notion-automation.js        # Notion 자동화 Wrapper 플러그인
```

## 🚀 빠른 시작

### 0. Node.js 확인

```bash
node -v
npm -v
```

**⚠️ nvm 사용자:**
Node.js를 nvm으로 설치한 경우, [NVM_INSTALL_GUIDE.md](./NVM_INSTALL_GUIDE.md)를 참조하세요.

### 1. Cronicle 설치

**일반 설치:**
```bash
cd ~/dev/dailyagent/cronicle
chmod +x *.sh
./install-cronicle.sh
```

**nvm 사용자 (권장):**
```bash
cd ~/dev/dailyagent/cronicle
./install-cronicle-manual.sh
```

### 2. Cronicle 초기화 및 시작

```bash
# 초기화 (최초 1회만)
sudo /opt/cronicle/bin/control.sh setup

# 시작
sudo /opt/cronicle/bin/control.sh start

# 또는 편의 스크립트 사용 (nvm 사용자)
./cronicle-start.sh
```

### 3. 웹 UI 접속

브라우저에서 `http://localhost:3012/` 접속

**초기 계정:** admin / admin

### 4. Notion 자동화 작업 등록

```bash
./register-notion-job.sh
```

스크립트 안내에 따라 API 키를 입력하면 자동으로 작업이 등록됩니다.

### 5. systemd 서비스 설정 (선택사항)

```bash
./setup-cronicle-service.sh
```

## 📖 상세 가이드

전체 마이그레이션 가이드는 [CRONICLE_MIGRATION.md](./CRONICLE_MIGRATION.md)를 참조하세요.

## 🎯 주요 기능

- ✅ 웹 UI로 작업 관리
- ✅ 실시간 로그 확인
- ✅ 작업 히스토리 추적
- ✅ 이메일/웹훅 알림
- ✅ 수동 실행 및 일시 중지
- ✅ 멀티 서버 지원

## 🔧 주요 명령어

### 일반 사용자

```bash
# Cronicle 시작/중지/재시작
sudo /opt/cronicle/bin/control.sh start
sudo /opt/cronicle/bin/control.sh stop
sudo /opt/cronicle/bin/control.sh restart

# 상태 확인
sudo /opt/cronicle/bin/control.sh status
```

### nvm 사용자 (편의 스크립트)

```bash
# Cronicle 시작/중지/재시작
./cronicle-start.sh
./cronicle-stop.sh
./cronicle-restart.sh

# 상태 확인
./cronicle-status.sh
```

### systemd 사용 시

```bash
sudo systemctl start cronicle
sudo systemctl stop cronicle
sudo systemctl restart cronicle
sudo systemctl status cronicle
```

### 로그 확인

```bash
# Cronicle 로그
tail -f /opt/cronicle/logs/cronicle.log

# systemd 로그 (서비스로 실행 시)
sudo journalctl -u cronicle -f
```

## 📝 작업 스케줄

현재 설정된 스케줄 (5시간마다):
- 00:00 (자정)
- 05:00 (오전 5시)
- 10:00 (오전 10시)
- 15:00 (오후 3시)
- 20:00 (오후 8시)

웹 UI에서 언제든지 변경 가능합니다.

## 🔔 알림 설정

작업 실패 시 관리자(admin)에게 알림이 전송됩니다.

웹 UI에서 이메일 주소를 설정하여 실제 알림을 받을 수 있습니다:
1. My Account > Edit
2. Email 입력
3. Save Changes

## 🔗 참고 링크

- [Cronicle 공식 GitHub](https://github.com/jhuckaby/Cronicle)
- [Cronicle 문서](https://github.com/jhuckaby/Cronicle/blob/master/docs/README.md)
- [설치 가이드](https://github.com/jhuckaby/Cronicle/blob/master/docs/Setup.md)

## ❓ 문제 해결

### nvm 사용자의 "NPM cannot be found" 오류

**증상:** 설치 시 "ERROR: NPM cannot be found" 메시지

**해결 방법:**
1. [NVM_INSTALL_GUIDE.md](./NVM_INSTALL_GUIDE.md) 참조
2. `install-cronicle-manual.sh` 사용:
   ```bash
   ./install-cronicle-manual.sh
   ```

### Cronicle이 시작되지 않음

```bash
# 로그 확인
tail -f /opt/cronicle/logs/cronicle.log

# 포트 충돌 확인
sudo netstat -tulpn | grep 3012

# nvm 사용자: PATH 확인
NODE_DIR=$(dirname $(which node))
sudo env "PATH=$NODE_DIR:$PATH" /opt/cronicle/bin/control.sh start
```

### 작업이 실행되지 않음

- 웹 UI에서 작업이 Enabled 상태인지 확인
- Schedule 설정이 올바른지 확인
- Servers 메뉴에서 서버가 활성 상태인지 확인

### 플러그인 오류

```bash
# 플러그인 직접 테스트
cd ~/dev/web-temp
node /opt/cronicle/plugins/notion-automation.js
```

## 🎉 마이그레이션 완료 후

기존 cron/launchd 작업을 중지하세요:

```bash
# launchd (macOS)
launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist

# cron (Linux/macOS)
crontab -e  # 해당 줄 주석 처리
```

---

**Happy Automating! 🚀**
