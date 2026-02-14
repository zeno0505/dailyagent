# Cronicle 설치 스크립트 테스트 가이드

## 수정된 버그

### BACKUP_DIR unbound variable 오류

**문제:**
- `set -euo pipefail` 옵션 사용 시, 정의되지 않은 변수 참조 시 오류 발생
- `BACKUP_DIR` 변수가 재설치 시에만 정의되어, 첫 설치 시 참조 오류 발생

**증상:**
```bash
./cronicle/install-cronicle.sh: line 146: BACKUP_DIR: unbound variable
```

**해결:**
1. `BACKUP_DIR=""` 초기화를 스크립트 상단에 추가
2. 조건문을 `[ -n "$BACKUP_DIR" ] && [ -d "$BACKUP_DIR" ]`로 개선

**수정된 파일:**
- `install-cronicle.sh`
- `install-cronicle-manual.sh`

## 테스트 시나리오

### 시나리오 1: 첫 설치 (깨끗한 시스템)

```bash
# 1. 기존 Cronicle 제거 (있는 경우)
sudo rm -rf /opt/cronicle

# 2. 설치 실행
cd ~/dev/dailyagent/cronicle
./install-cronicle-manual.sh

# 3. 예상 결과
# - BACKUP_DIR 오류 없이 설치 완료
# - /opt/cronicle 디렉토리 생성
# - 편의 스크립트 생성 (cronicle-start.sh 등)
```

### 시나리오 2: 재설치 (기존 설치 존재)

```bash
# 1. Cronicle이 이미 설치된 상태에서 실행
cd ~/dev/dailyagent/cronicle
./install-cronicle-manual.sh

# 2. 프롬프트에서 'y' 입력
# 재설치하시겠습니까? (y/N): y

# 3. 예상 결과
# - 기존 설치 백업 (/opt/cronicle.backup.YYYYMMDD-HHMMSS)
# - 새로 설치
# - 기존 설정 파일을 config.json.backup으로 저장
```

### 시나리오 3: 재설치 취소

```bash
# 1. 설치 스크립트 실행
./install-cronicle-manual.sh

# 2. 프롬프트에서 'n' 입력
# 재설치하시겠습니까? (y/N): n

# 3. 예상 결과
# - "설치를 취소했습니다" 메시지
# - 기존 설치 유지
```

## 검증 체크리스트

### 설치 후 확인 사항

```bash
# 1. 디렉토리 구조 확인
ls -la /opt/cronicle
# 예상: bin/, conf/, htdocs/, lib/, node_modules/, logs/ 등

# 2. 실행 파일 확인
ls -la /opt/cronicle/bin/control.sh
# 예상: 실행 권한 있음

# 3. 설정 파일 확인
ls -la /opt/cronicle/conf/config.json
# 예상: JSON 형식의 설정 파일

# 4. 편의 스크립트 확인 (nvm 사용자)
ls -la ~/dev/dailyagent/cronicle/cronicle-*.sh
# 예상: start, stop, restart, status 스크립트

# 5. 권한 확인
ls -ld /opt/cronicle
# 예상: 소유자가 현재 사용자
```

### 실행 테스트

```bash
# 1. 초기화 (최초 1회만)
sudo /opt/cronicle/bin/control.sh setup

# 2. 시작
cd ~/dev/dailyagent/cronicle
./cronicle-start.sh

# 3. 상태 확인
./cronicle-status.sh

# 4. 로그 확인
tail -f /opt/cronicle/logs/cronicle.log

# 5. 웹 UI 접속
curl http://localhost:3012/
# 예상: HTML 응답

# 6. API 테스트
curl http://localhost:3012/api/app/ping
# 예상: {"code":0}

# 7. 중지
./cronicle-stop.sh
```

## 변수 초기화 검증

### Bash 엄격 모드 테스트

```bash
# 스크립트에서 set -euo pipefail 사용 시:
# -e: 오류 발생 시 즉시 종료
# -u: 정의되지 않은 변수 사용 시 오류
# -o pipefail: 파이프라인에서 오류 전파

# 테스트 방법
bash -n install-cronicle.sh  # 문법 검사
bash -x install-cronicle.sh  # 디버그 모드 실행 (실제 설치 안 함)
```

### 모든 변수 정의 확인

```bash
# 각 스크립트에서 사용되는 모든 변수 추출
grep -o '\$[A-Z_]*' install-cronicle.sh | sort -u

# 예상 변수들:
# $BACKUP_DIR
# $BLUE
# $GREEN
# $INSTALL_DIR
# $LATEST_VERSION
# $NC
# $NODE_BIN
# $NODE_DIR
# $NPM_BIN
# $NPM_VERSION
# $NODE_VERSION
# $RED
# $REPLY
# $SCRIPT_DIR
# $YELLOW
```

## 일반적인 문제 해결

### 1. 권한 오류

```bash
# 증상: Permission denied
# 해결: sudo 사용 또는 권한 변경
sudo chown -R $USER:$(id -gn) /opt/cronicle
```

### 2. 포트 충돌

```bash
# 증상: Port 3012 already in use
# 확인:
sudo netstat -tulpn | grep 3012

# 해결:
# 1. 기존 프로세스 종료
# 2. 또는 config.json에서 다른 포트 사용
```

### 3. Node.js PATH 문제 (nvm)

```bash
# 증상: node or npm not found
# 확인:
which node
which npm

# 해결:
NODE_DIR=$(dirname $(which node))
echo $NODE_DIR
# 스크립트가 자동으로 처리하지만, 수동 실행 시 PATH 지정 필요
```

### 4. 백업 디렉토리 문제

```bash
# 백업 확인
ls -la /opt/cronicle.backup*

# 백업 복원 (필요시)
sudo rm -rf /opt/cronicle
sudo mv /opt/cronicle.backup.20260213-123456 /opt/cronicle
```

## 스크립트 안전성 검증

### 1. 에러 처리

모든 주요 명령에 에러 체크 포함:
```bash
if [ $? -ne 0 ]; then
    echo "오류 발생"
    exit 1
fi
```

### 2. 롤백 메커니즘

재설치 실패 시 백업에서 복원:
```bash
# 백업 디렉토리가 존재하면 복원 가능
sudo mv /opt/cronicle.backup.YYYYMMDD-HHMMSS /opt/cronicle
```

### 3. 입력 검증

사용자 입력 검증:
```bash
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "설치를 취소했습니다"
    exit 0
fi
```

## 성능 테스트

### 설치 시간 측정

```bash
time ./install-cronicle-manual.sh
# 예상: 2-5분 (네트워크 속도에 따라)
```

### 리소스 사용량

```bash
# Cronicle 실행 후
ps aux | grep cronicle
# 메모리 사용량 확인

df -h /opt/cronicle
# 디스크 사용량 확인 (약 100-200MB)
```

## 회귀 테스트

새로운 변경 후 반드시 테스트:

1. ✅ 첫 설치 (깨끗한 시스템)
2. ✅ 재설치 (기존 설치 존재)
3. ✅ 재설치 취소
4. ✅ nvm 환경에서 설치
5. ✅ 시스템 Node.js 환경에서 설치
6. ✅ 편의 스크립트 생성 확인
7. ✅ Cronicle 시작/중지/재시작
8. ✅ 웹 UI 접속
9. ✅ 로그 확인

## 문서 업데이트 확인

변경 사항 반영된 문서:

- [x] README.md
- [x] QUICKSTART-CRONICLE.md
- [x] NVM_INSTALL_GUIDE.md
- [x] CRONICLE_MIGRATION.md
- [x] TESTING.md (이 파일)

---

**테스트 완료 체크리스트:**

- [ ] 첫 설치 성공 (BACKUP_DIR 오류 없음)
- [ ] 재설치 성공 (백업 생성됨)
- [ ] 편의 스크립트 생성됨
- [ ] Cronicle 시작 성공
- [ ] 웹 UI 접속 가능
- [ ] 로그에 오류 없음
