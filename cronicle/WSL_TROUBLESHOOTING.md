# WSL 환경에서 Cronicle 권한 문제 해결

## 🐛 문제 증상

```
Error: EACCES: permission denied, open 'logs/Cronicle.log'
```

systemd로 Cronicle 시작 시 로그 파일에 쓰기 권한이 없어서 실패합니다.

## 🔍 원인

### WSL 파일시스템 제한

WSL(Windows Subsystem for Linux)에서는 Linux 파일 권한이 완전히 지원되지 않습니다:

1. **/opt/cronicle** 디렉토리가 root 소유
2. **/opt/cronicle/logs**가 nobody 소유로 변경됨
3. `chown` 명령이 "Invalid argument" 오류 발생
4. systemd 서비스가 일반 사용자로 실행 → 권한 없음

## ✅ 해결 방법

터미널에서 직접 실행:

```bash
# 1. Cronicle 중지
sudo systemctl stop cronicle
sudo pkill -f cronicle

# 2. systemd 서비스 파일 수정
sudo tee /etc/systemd/system/cronicle.service > /dev/null <<'EOF'
[Unit]
Description=Cronicle Distributed Task Scheduler
Documentation=https://github.com/jhuckaby/Cronicle
After=network.target

[Service]
Type=forking
User=root
Group=root
WorkingDirectory=/opt/cronicle
ExecStart=/opt/cronicle/bin/control.sh start
ExecStop=/opt/cronicle/bin/control.sh stop
ExecReload=/opt/cronicle/bin/control.sh restart
PIDFile=/opt/cronicle/logs/cronicle.pid
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

Environment="NODE_ENV=production"
Environment="PATH=/usr/local/bin:/usr/bin:/bin"

LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

# 3. systemd 데몬 리로드
sudo systemctl daemon-reload

# 4. Cronicle 시작
sudo systemctl start cronicle

# 5. 상태 확인
sudo systemctl status cronicle
```

### 방법 3: systemd 없이 직접 실행

systemd를 사용하지 않고 직접 실행:

```bash
# 시작
sudo /opt/cronicle/bin/control.sh start

# 중지
sudo /opt/cronicle/bin/control.sh stop

# 상태 확인
sudo /opt/cronicle/bin/control.sh status
```

## 🔍 검증

### 1. 서비스 상태 확인

```bash
sudo systemctl status cronicle
```

**정상 출력:**
```
● cronicle.service - Cronicle Distributed Task Scheduler
   Loaded: loaded (/etc/systemd/system/cronicle.service; enabled)
   Active: active (running) since ...
```

### 2. 웹 UI 접속

```bash
curl http://localhost:3012/
```

또는 브라우저에서:
```
http://localhost:3012/
```

### 3. 로그 확인

```bash
# Cronicle 로그
tail -f /opt/cronicle/logs/Cronicle.log

# systemd 로그
sudo journalctl -u cronicle -f
```

## ⚠️ 보안 고려사항

### WSL 개발 환경

WSL은 개발 환경이므로 root로 실행해도 문제없습니다:
- ✅ 로컬 개발 전용
- ✅ 외부 접근 불가
- ✅ Windows와 격리됨

### 프로덕션 환경

실제 프로덕션 Linux 서버에서는:
- ⚠️ 전용 사용자 생성 권장
- ⚠️ 최소 권한 원칙 적용
- ⚠️ SELinux/AppArmor 설정

```bash
# 프로덕션 환경 예시
sudo useradd -r -s /bin/false cronicle
sudo chown -R cronicle:cronicle /opt/cronicle
# systemd 서비스에서 User=cronicle, Group=cronicle 설정
```

## 🔄 대안: Docker 사용

WSL에서 권한 문제를 피하려면 Docker 사용:

```bash
# Cronicle Docker 이미지
docker run -d \
  -p 3012:3012 \
  -v $(pwd)/data:/opt/cronicle/data \
  --name cronicle \
  jhuckaby/cronicle
```

## 📊 WSL vs 네이티브 Linux 비교

| 항목 | WSL | 네이티브 Linux |
|------|-----|----------------|
| 파일 권한 | ⚠️ 제한적 | ✅ 완전 지원 |
| chown | ⚠️ 오류 발생 | ✅ 정상 동작 |
| systemd | ✅ 지원 (WSL2) | ✅ 지원 |
| 권장 해결책 | root로 실행 | 전용 사용자 |

## 🐛 문제 해결

### "Invalid argument" 오류

```bash
chown: changing ownership of '/opt/cronicle/...': Invalid argument
```

**원인:** WSL 파일시스템 제한  
**해결:** systemd 서비스를 root로 실행

### "Permission denied" 오류

```bash
Error: EACCES: permission denied, open 'logs/Cronicle.log'
```

**원인:** logs 디렉토리 쓰기 권한 없음  
**해결:** `./fix-permissions.sh` 실행

### 서비스 시작 실패

```bash
sudo systemctl status cronicle
# Failed to start cronicle.service
```

**확인 사항:**
1. 로그 확인: `sudo journalctl -u cronicle -n 50`
2. 수동 실행 테스트: `sudo /opt/cronicle/bin/control.sh start`
3. Node.js 경로 확인: `which node`

### 포트 충돌

```bash
Error: listen EADDRINUSE: address already in use :::3012
```

**해결:**
```bash
# 기존 프로세스 확인
sudo netstat -tulpn | grep 3012

# 종료
sudo pkill -f cronicle

# 재시작
sudo systemctl restart cronicle
```

## 📚 참고 자료

- [WSL 파일 권한](https://docs.microsoft.com/en-us/windows/wsl/file-permissions)
- [Cronicle 공식 문서](https://github.com/jhuckaby/Cronicle/blob/master/docs/Setup.md)
- [systemd 서비스 관리](https://www.freedesktop.org/software/systemd/man/systemd.service.html)

## ✅ 체크리스트

해결 후 확인:

- [ ] `sudo systemctl status cronicle` → active (running)
- [ ] `curl http://localhost:3012/` → HTML 응답
- [ ] 웹 UI 로그인 가능
- [ ] `/opt/cronicle/logs/Cronicle.log` 파일 생성됨
- [ ] 에러 로그 없음

---

**WSL 환경에서 Cronicle을 root로 실행하는 것은 정상적인 해결 방법입니다.** 🎉
