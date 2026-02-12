# Cronicle 플러그인 변경 이력

## v2.0.0 (2026-02-13) - Wrapper 패턴 적용

### 🔄 주요 변경사항

**플러그인 구조 변경:**
- ❌ 제거: 독립 구현 플러그인 (`notion-automation.js` - Node.js 전체 재구현)
- ✅ 추가: Wrapper 플러그인 (`notion-automation.js` - 기존 스크립트 래핑)

### 📋 변경 이유

1. **코드 중복 제거**
   - 기존: `notion-cron-job.sh`와 `notion-automation.js` 로직 중복
   - 개선: 하나의 로직(`notion-cron-job.sh`)만 유지, 플러그인은 래퍼로 동작

2. **유지보수 간소화**
   - 기존: 버그 수정 시 두 파일 모두 수정 필요
   - 개선: `notion-cron-job.sh`만 수정하면 Cronicle에서도 자동 반영

3. **일관성 향상**
   - cron/launchd와 Cronicle이 동일한 로직 사용
   - 동작이 완전히 동일하게 보장됨

### 🎯 Wrapper 플러그인 특징

**기능:**
- `notion-cron-job.sh` 스크립트 실행
- 실행 중 진행률을 Cronicle에 보고
- 스크립트 출력을 Cronicle 로그로 전달
- 결과 파일 자동 파싱 및 반환

**장점:**
- ✅ 로직 중복 없음
- ✅ 한 곳만 수정하면 됨
- ✅ 기존 스크립트 재사용
- ✅ Cronicle의 모든 기능(진행률, 로그, 히스토리) 지원

**개선사항:**
- 스크립트 파일 존재 확인
- 실행 권한 자동 확인
- 더 나은 에러 처리
- 결과 파일 자동 파싱
- 자식 프로세스 정리 (SIGTERM/SIGINT)
- 진행률 키워드 감지 및 보고

### 📦 설치 방법

```bash
cd ~/dev/dailyagent/cronicle

# 기존 작업 삭제 (웹 UI에서)
# Schedule > 작업 선택 > Delete

# 플러그인 재등록
./register-notion-job.sh
```

### 🔧 설정

**플러그인 매개변수:**
- `script_path`: 실행할 스크립트 경로 (기본값: `~/dev/dailyagent/notion-cron-job.sh`)

웹 UI에서 스크립트 경로를 변경할 수 있습니다.

### 🧪 테스트

**수동 테스트:**
```bash
# 플러그인 직접 실행
cd /opt/cronicle/plugins
JOB_PARAMS='{"script_path":"'$HOME'/dev/dailyagent/notion-cron-job.sh"}' node notion-automation.js

# 또는 웹 UI에서 "Run Now" 클릭
```

**확인 사항:**
- ✅ 진행률이 표시되는가?
- ✅ 로그가 실시간으로 나오는가?
- ✅ 작업이 정상 완료되는가?
- ✅ 결과가 올바르게 저장되는가?

### 📊 성능

**리소스 사용:**
- 메모리: Wrapper 추가로 약 20-30MB 증가
- CPU: 영향 없음 (단순 프로세스 래핑)
- 디스크: 영향 없음

**실행 시간:**
- 오버헤드: 약 1-2초 (스크립트 검증 및 초기화)
- 전체 실행 시간: 기존과 동일

### 🔄 마이그레이션 가이드

**cron/launchd 사용자:**
- 변경 없음, 계속 `notion-cron-job.sh` 사용

**Cronicle 사용자:**
1. 웹 UI에서 기존 작업 삭제
2. `./register-notion-job.sh` 실행하여 새 작업 등록
3. "Run Now"로 테스트 실행

### 🐛 알려진 이슈

없음

### 📚 참고 문서

- [PLUGIN_COMPARISON.md](./PLUGIN_COMPARISON.md) - 구현 방식 비교
- [README.md](./README.md) - 사용 가이드
- [CRONICLE_MIGRATION.md](./CRONICLE_MIGRATION.md) - 마이그레이션 가이드

---

## v1.0.0 (2026-02-13) - 초기 릴리스

### 🎉 기능

- Cronicle 설치 스크립트
- 독립 구현 플러그인 (현재 제거됨)
- systemd 서비스 설정
- nvm 사용자 지원
- 상세 문서

---

**현재 버전:** v2.0.0  
**권장 사항:** Wrapper 플러그인 사용  
**호환성:** notion-cron-job.sh v1.0.0+
