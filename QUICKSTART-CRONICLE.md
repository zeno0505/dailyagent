# Cronicle 빠른 시작 가이드

이 문서는 5분 안에 Cronicle을 설치하고 Notion 자동화 작업을 시작하는 방법을 안내합니다.

## ⚡ 5분 빠른 시작

### 1단계: Cronicle 설치 (1-2분)

**Node.js 설치 방법 확인:**
```bash
which node
# nvm 사용자: /home/user/.nvm/versions/node/...
# 시스템 설치: /usr/bin/node 또는 /usr/local/bin/node
```

**일반 사용자 (시스템 Node.js):**
```bash
cd ~/dev/dailyagent/cronicle
./install-cronicle.sh
```

**nvm 사용자 (권장):**
```bash
cd ~/dev/dailyagent/cronicle
./install-cronicle-manual.sh
```

⚠️ **"NPM cannot be found" 오류가 발생하면** `install-cronicle-manual.sh`를 사용하세요!

스크립트가 자동으로:
- ✅ Node.js 버전 확인
- ✅ Cronicle 다운로드 및 설치
- ✅ 설정 파일 적용
- ✅ 편의 스크립트 생성 (nvm 사용자)

### 2단계: Cronicle 초기화 및 시작 (1분)

**초기화 (최초 1회만):**
```bash
sudo /opt/cronicle/bin/control.sh setup
```

**시작:**

일반 사용자:
```bash
sudo /opt/cronicle/bin/control.sh start
```

nvm 사용자 (편의 스크립트):
```bash
cd ~/dev/dailyagent/cronicle
./cronicle-start.sh
```

### 3단계: 웹 UI 접속 (30초)

브라우저를 열고 접속:
```
http://localhost:3012/
```

**로그인:**
- 아이디: `admin`
- 비밀번호: `admin`

⚠️ **중요:** 로그인 후 즉시 비밀번호를 변경하세요!

1. 상단 메뉴 > **My Account**
2. **Edit** 클릭
3. **New Password** 입력
4. **Save Changes**

### 4단계: API 키 생성 (1분)

1. 상단 메뉴 > **My Account**
2. **API Keys** 탭
3. **Create API Key** 클릭
4. 다음 정보 입력:
   - **Title**: `Notion Automation`
   - **Privileges**: `Administrator` 선택
5. **Create API Key** 버튼 클릭
6. 생성된 API 키를 **복사** (다음 단계에서 사용)

### 5단계: Notion 작업 등록 (2분)

터미널로 돌아가서:

```bash
cd ~/dev/dailyagent/cronicle
./register-notion-job.sh
```

스크립트 안내에 따라:
1. 4단계에서 복사한 **API 키 입력**
2. Enter 키를 누르면 자동으로:
   - ✅ 플러그인 설치
   - ✅ 카테고리 생성
   - ✅ 작업 등록 완료

### 6단계: 작업 확인 및 테스트 (30초)

웹 UI로 돌아가서:

1. 좌측 메뉴 > **Schedule** 클릭
2. "Notion 자동화 작업 (5시간마다)" 항목 확인
3. 작업 클릭 > **Run Now** 버튼으로 즉시 실행 가능
4. **View Live Log**로 실시간 로그 확인

## ✅ 설치 완료!

축하합니다! 이제 Cronicle이 다음 시간에 자동으로 작업을 실행합니다:
- 00:00 (자정)
- 05:00 (오전 5시)
- 10:00 (오전 10시)
- 15:00 (오후 3시)
- 20:00 (오후 8시)

## 🎯 다음 단계

### systemd 서비스 설정 (선택사항, 권장)

시스템 부팅 시 Cronicle을 자동으로 시작:

```bash
cd ~/dev/dailyagent/cronicle
./setup-cronicle-service.sh
```

이후 systemd로 관리:
```bash
sudo systemctl status cronicle  # 상태 확인
sudo systemctl restart cronicle # 재시작
sudo journalctl -u cronicle -f  # 로그 확인
```

### 기존 cron/launchd 작업 중지

Cronicle이 정상 작동하는 것을 확인한 후:

**macOS (launchd):**
```bash
launchctl unload ~/Library/LaunchAgents/com.fanding.notion-cron.plist
```

**Linux (cron):**
```bash
crontab -e
# 해당 줄 주석 처리 (앞에 # 추가)
```

## 📖 추가 문서

- [CRONICLE_MIGRATION.md](./cronicle/CRONICLE_MIGRATION.md) - 상세 마이그레이션 가이드
- [README.md](./README.md) - 전체 프로젝트 문서
- [cronicle/README.md](./cronicle/README.md) - Cronicle 사용법

## 🎨 주요 기능 활용

### 작업 수동 실행

웹 UI > **Schedule** > 작업 선택 > **Run Now**

### 실시간 로그 확인

웹 UI > **Live Jobs** > 작업 클릭 > **View Live Log**

### 작업 히스토리

웹 UI > **Completed Jobs** > 성공/실패 작업 확인

### 스케줄 변경

웹 UI > **Schedule** > 작업 선택 > **Edit Event** > **Timing** 수정

### 이메일 알림 설정

1. **My Account** > **Edit**
2. **Email** 입력
3. **Save Changes**
4. 작업 설정에서 **Notify on Failure** 활성화

## 🔧 문제 해결

### "NPM cannot be found" 오류

**증상:** 설치 중 "ERROR: NPM cannot be found" 메시지

**원인:** nvm을 사용하여 Node.js를 설치한 경우

**해결 방법:**
```bash
cd ~/dev/dailyagent/cronicle
./install-cronicle-manual.sh
```

**자세한 가이드:** [NVM_INSTALL_GUIDE.md](./cronicle/NVM_INSTALL_GUIDE.md)

### Cronicle이 시작되지 않음

```bash
# 로그 확인
tail -f /opt/cronicle/logs/cronicle.log

# 포트 충돌 확인 (3012 포트)
sudo netstat -tulpn | grep 3012

# nvm 사용자: PATH 지정하여 시작
NODE_DIR=$(dirname $(which node))
sudo env "PATH=$NODE_DIR:$PATH" /opt/cronicle/bin/control.sh start

# 또는 편의 스크립트 사용
cd ~/dev/dailyagent/cronicle
./cronicle-start.sh
```

### 작업 등록이 실패함

```bash
# Cronicle 서버 확인
curl http://localhost:3012/api/app/ping

# API 키 재생성
# 웹 UI에서 기존 키 삭제 후 새로 생성

# 다시 등록
cd ~/dev/dailyagent/cronicle
./register-notion-job.sh
```

### 플러그인 오류

```bash
# 플러그인 수동 설치
sudo cp ~/dev/dailyagent/cronicle/plugins/notion-automation.js /opt/cronicle/plugins/
sudo chmod +x /opt/cronicle/plugins/notion-automation.js

# 플러그인 테스트
cd ~/dev/web-temp
node /opt/cronicle/plugins/notion-automation.js
```

## 💡 팁

### 빠른 명령어

**일반 사용자:**
```bash
# Cronicle 시작/중지/재시작
sudo /opt/cronicle/bin/control.sh start
sudo /opt/cronicle/bin/control.sh stop
sudo /opt/cronicle/bin/control.sh restart
```

**nvm 사용자 (편의 스크립트):**
```bash
cd ~/dev/dailyagent/cronicle
./cronicle-start.sh
./cronicle-stop.sh
./cronicle-restart.sh
./cronicle-status.sh
```

**systemd 사용 시:**
```bash
sudo systemctl start cronicle
sudo systemctl stop cronicle
sudo systemctl restart cronicle
```

**로그 확인:**
```bash
tail -f /opt/cronicle/logs/cronicle.log
sudo journalctl -u cronicle -f  # systemd 사용 시
```

**웹 UI 접속:**
```bash
xdg-open http://localhost:3012/  # Linux
open http://localhost:3012/      # macOS
```

### 추천 설정

1. **이메일 주소 설정** - 작업 실패 시 알림 받기
2. **비밀번호 변경** - 보안 강화
3. **타임존 확인** - 작업 설정 > Timezone이 Asia/Seoul인지 확인
4. **systemd 서비스** - 시스템 부팅 시 자동 시작

## 🎉 완료!

이제 Cronicle을 통해 Notion 자동화 작업을 웹 UI에서 편리하게 관리할 수 있습니다!

질문이나 문제가 있으면 [CRONICLE_MIGRATION.md](./cronicle/CRONICLE_MIGRATION.md)의 문제 해결 섹션을 참조하세요.

---

**Happy Automating! 🚀**
