# DailyAgent 테스트 현황 보고서

**작성일**: 2026-02-17
**프로젝트**: DailyAgent - AI-powered Task Automation CLI
**버전**: 현재 개발 중

## 📋 목차
1. [프로젝트 개요](#프로젝트-개요)
2. [현재 테스트 현황](#현재-테스트-현황)
3. [구현된 기능 목록](#구현된-기능-목록)
4. [테스트 범위 분석](#테스트-범위-분석)
5. [테스트되지 않은 영역](#테스트되지-않은-영역)
6. [발견된 이슈](#발견된-이슈)
7. [향후 테스트 개선 계획](#향후-테스트-개선-계획)

---

## 프로젝트 개요

**DailyAgent**는 AI 기반 작업 자동화 CLI 도구로, 다음과 같은 특징을 가집니다:

- **기술 스택**: Node.js/TypeScript, Commander.js, Notion MCP Server
- **주요 기능**: Notion DB 연동, Claude Code/Cursor 자동 실행, Git 자동화
- **작업 흐름**:
  - Phase 1: Notion 데이터베이스에서 대기 중인 작업 조회
  - Phase 2: Claude Code/Cursor를 통한 자동 코드 작업 + Git Push
  - Phase 3: 작업 결과를 Notion에 업데이트
  - Phase 4: (선택) Slack 알림 발송

### 아키텍처 구조

```
src/
├── cli.ts                      # Commander 기반 CLI 진입점
├── commands/                   # 10개의 CLI 명령어 구현
│   ├── init.ts                # 설정 초기화
│   ├── register.ts            # 작업 등록
│   ├── list.ts                # 작업 목록 조회
│   ├── run.ts                 # 작업 즉시 실행
│   ├── unregister.ts          # 작업 삭제
│   ├── pause.ts               # 작업 일시중지
│   ├── resume.ts              # 작업 재개
│   ├── status.ts              # 작업 상태 조회
│   ├── logs.ts                # 로그 조회
│   └── schedule.ts            # OS 스케줄러 연동
├── core/                       # 핵심 실행 엔진
│   ├── executor.ts            # 작업 실행 오케스트레이터
│   ├── cli-runner.ts          # Claude Code/Cursor 실행기
│   └── prompt-generator.ts    # AI 프롬프트 템플릿 생성
├── utils/                      # 유틸리티 모듈
│   ├── executor.ts            # 환경 검증, 설정 해석
│   ├── logs.ts                # 파일 기반 로깅
│   ├── markdown.ts            # JSON 추출
│   ├── notion-api.ts          # Notion REST API 호출
│   ├── process.ts             # PID 관리
│   └── schedule.ts            # 스케줄링 (cron/launchd)
├── types/                      # TypeScript 타입 정의
├── test/                       # 수동 테스트 스크립트
│   ├── run-cli.ts             # Claude/Cursor 실행 테스트
│   └── notion-api.ts          # Notion API 연동 테스트
├── config.ts                   # 설정 관리 (~/.dailyagent/)
├── jobs.ts                     # 작업 CRUD + PID 잠금
└── logger.ts                   # 타임스탬프 파일 로거
```

---

## 현재 테스트 현황

### 수동 테스트 스크립트 (src/test/)

현재 다음 2가지 수동 테스트 스크립트가 존재합니다:

#### 1. **run-cli.ts** - Claude Code/Cursor 실행 테스트
```typescript
// 목적: Claude Code와 Cursor Agent의 기본 실행 여부 확인
// 테스트 항목:
// - Claude Code 실행 및 JSON 결과 파싱
// - Cursor Agent 실행 및 JSON 결과 파싱
// - 간단한 배열 생성 작업 수행

// 실행 방법:
npx ts-node src/test/run-cli.ts
```

**테스트 범위**:
- ✅ CLI 설치 여부 확인
- ✅ stdin을 통한 프롬프트 전달
- ✅ JSON 출력 파싱
- ✅ 타임아웃 처리

**한계**:
- ❌ 실제 작업 환경에서의 동작 테스트 없음
- ❌ Git 연동 테스트 없음
- ❌ Notion 데이터 영속성 검증 없음

#### 2. **notion-api.ts** - Notion API 연동 테스트
```typescript
// 목적: Notion API 직접 호출 및 데이터 조회 확인
// 테스트 항목:
// - Notion 설정 로드
// - API 토큰/데이터소스 ID 검증
// - fetchPendingTask() 함수 호출

// 실행 방법:
npx ts-node src/test/notion-api.ts
```

**테스트 범위**:
- ✅ 설정 파일 로드
- ✅ API 토큰 유효성 검증
- ✅ 대기 중인 작업 조회

**한계**:
- ❌ 결과 검증 로직 부재
- ❌ 에러 케이스 처리 미흡
- ❌ 다양한 DB 구조에 대한 테스트 없음

### 자동화된 테스트 프레임워크

**현재 상태**: ❌ 없음

- Jest/Vitest 등의 테스트 프레임워크 미도입
- Unit 테스트 미작성
- E2E 테스트 미작성
- CI/CD 파이프라인 내 테스트 실행 미구현

---

## 구현된 기능 목록

### CLI 명령어 (10개)

| 명령어 | 설명 | 상태 | 수동테스트 |
|--------|------|------|----------|
| `dailyagent init` | Notion DB URL 및 컬럼 매핑 설정 | ✅ | △ |
| `dailyagent register` | 새로운 작업 등록 | ✅ | △ |
| `dailyagent list` | 등록된 작업 목록 조회 | ✅ | △ |
| `dailyagent run <name>` | 작업 즉시 실행 | ✅ | ✅ |
| `dailyagent unregister <name>` | 작업 삭제 | ✅ | △ |
| `dailyagent pause <name>` | 작업 일시중지 | ✅ | △ |
| `dailyagent resume <name>` | 작업 재개 | ✅ | △ |
| `dailyagent status <name>` | 작업 상태 및 실행 이력 조회 | ✅ | △ |
| `dailyagent logs <name>` | 로그 파일 조회 및 실시간 모니터링 | ✅ | △ |
| `dailyagent schedule <action> [name]` | OS 스케줄러 연동 (cron/launchd) | ✅ | △ |

### 핵심 모듈 (Core)

#### 1. **Executor** (`src/core/executor.ts`)
- **용도**: 3단계 작업 실행 오케스트레이션
- **주요 기능**:
  - Phase 1: Notion 조회 (Notion API 또는 MCP)
  - Phase 2: Claude Code/Cursor 자동 실행
  - Phase 3: Notion 업데이트 (Notion API 또는 MCP)
  - Phase 4: Slack 알림 (선택사항)
- **테스트 상태**: 수동 테스트만 수행됨

#### 2. **CLI Runner** (`src/core/cli-runner.ts`)
- **용도**: Claude Code / Cursor Agent 실행
- **주요 기능**:
  - CLI 명령어 실행 (spawn)
  - stdin을 통한 프롬프트 전달
  - JSON 결과 파싱
  - 타임아웃 처리
  - 보안: 환경 변수 화이트리스트 (PATH, HOME, USER, SSH_AUTH_SOCK)
  - 보안: API 키/토큰 마스킹
- **테스트 상태**: 기본 동작 검증만 수행됨

#### 3. **Prompt Generator** (`src/core/prompt-generator.ts`)
- **용도**: AI 프롬프트 템플릿 생성
- **주요 기능**:
  - Phase 1 프롬프트: Notion 데이터 조회 지시사항
  - Phase 2 프롬프트: 코드 작업 지시사항 (Git, 커밋, PR 생성)
  - Phase 3 프롬프트: Notion 업데이트 지시사항
- **테스트 상태**: 수동 확인만 수행됨

### 유틸리티 모듈 (Utils)

| 모듈 | 기능 | 테스트 |
|------|------|--------|
| **executor.ts** | 환경 검증, 설정 파일 해석 | △ |
| **notion-api.ts** | Notion REST API 호출 | △ |
| **logs.ts** | 파일 기반 로깅 (타임스탬프) | △ |
| **schedule.ts** | crontab/launchd 스케줄링 | △ |
| **process.ts** | PID 관리 | △ |
| **markdown.ts** | JSON 코드블록 추출 | △ |

### 설정 및 상태 관리

| 모듈 | 기능 | 테스트 |
|------|------|--------|
| **config.ts** | `~/.dailyagent/config.json` 관리 | △ |
| **jobs.ts** | 작업 CRUD, PID 잠금 | △ |
| **logger.ts** | 타임스탐프 파일 로거 | △ |

---

## 테스트 범위 분석

### ✅ 테스트된 영역 (Coverage Available)

1. **CLI 명령어 기본 동작**
   - 명령 인식 및 실행
   - 옵션 파싱 (예: `-n`, `-f`, `--count`)
   - 에러 메시지 출력

2. **Claude Code/Cursor 실행**
   - 프로세스 스폰 및 실행
   - stdin/stdout 통신
   - JSON 파싱
   - 타임아웃 처리

3. **Notion API 연동** (API 사용 모드)
   - API 토큰 유효성
   - 데이터 조회 및 파싱
   - 페이지 업데이트

4. **설정 관리**
   - 설정 파일 생성 및 로드
   - 기본값 할당

5. **로깅 시스템**
   - 타임스탬프 기반 파일 로깅
   - 로그 파일 생성 및 조회

### ❌ 테스트되지 않은 영역 (Coverage Gap)

#### 1. **Unit 테스트 부재**
- 개별 함수의 입력/출력 검증 없음
- 엣지 케이스(edge case) 미검증
- 정규식, 문자열 파싱 로직 미검증

#### 2. **통합(Integration) 테스트 부재**
- Notion DB + Claude Code + Git의 전체 흐름 테스트 없음
- MCP 서버와의 상호작용 검증 없음
- 에러 복구 시나리오 미검증

#### 3. **Git 관련 기능**
- 브랜치 생성/삭제/전환
- 커밋 작성 및 푸시
- PR 생성 및 관리
- 머지 충돌 해결
- **현재**: Claude Code에서 수행되며, 결과만 검증 가능

#### 4. **에러 처리 및 예외 상황**
- 네트워크 실패 (Notion API, Git push)
- 타임아웃 복구
- 잠금 파일 상태 이상
- 디스크 부족
- 권한 오류

#### 5. **보안 검증**
- 환경 변수 화이트리스트 적절성
- API 키 마스킹 로직
- 민감한 정보 로깅 금지

#### 6. **스케줄링 (Schedule)**
- crontab 작업 등록/삭제
- launchd plist 파일 생성/제거
- 스케줄 시간 정확성
- OS별 호환성 (macOS/Linux/Windows)

#### 7. **멀티-탄시 실행 (Concurrency)**
- PID 잠금 메커니즘
- 동시 실행 방지
- 잠금 타임아웃

#### 8. **상태 관리**
- Job 상태 전이 (paused → running → success/error)
- 메타데이터 업데이트
- 마지막 실행 시간 기록

#### 9. **Notion 데이터 검증**
- 필수 컬럼 존재 여부 확인
- 컬럼 타입 불일치
- 잘못된 URL 형식
- API 데이터 일관성

#### 10. **로그 파일 관리**
- 로그 파일 크기 제한
- 로그 로테이션
- 오래된 로그 삭제

#### 11. **커스텀 프롬프트 모드**
- 프롬프트 파일 로드
- 변수 치환 ({{workDir}}, {{taskInfo}})
- 파일 존재 여부 확인

#### 12. **Slack 알림**
- 웹훅 전송
- 메시지 포맷
- 실패 시나리오

---

## 테스트되지 않은 영역

### 심각도별 분류

#### 🔴 **Critical** - 즉시 테스트 필요

1. **3단계 작업 흐름 (Phase 1-3-3)**
   - 실제 Notion DB 연동 테스트
   - 실제 GitHub 저장소에서 브랜치 생성 및 푸시
   - 전체 자동화 워크플로우 E2E 테스트
   - **영향**: 핵심 기능 동작 여부

2. **에러 복구 (Error Recovery)**
   - Notion API 호출 실패 시 재시도
   - Claude Code 타임아웃 처리
   - Git 푸시 실패 시 상태 롤백
   - **영향**: 프로덕션 환경 안정성

3. **PID 잠금 메커니즘**
   - 동시 실행 방지
   - 좀비 프로세스 처리
   - **영향**: 중복 작업 실행 방지

#### 🟠 **High** - 우선순위 높음

1. **Git 명령어 검증**
   - 브랜치명 유효성 (특수문자 처리)
   - 커밋 메시지 포맷 (conventional commits)
   - PR 본문 포맷
   - **영향**: GitHub 업로드 안정성

2. **Notion 컬럼 매핑**
   - 커스텀 컬럼명 지원
   - 컬럼 타입 검증
   - 필수 컬럼 확인
   - **영향**: 다양한 DB 구조 지원

3. **타임아웃 처리**
   - 각 Phase별 적절한 타임아웃 설정
   - 타임아웃 후 정리 작업
   - **영향**: 무한 대기 방지

#### 🟡 **Medium** - 개선 권장

1. **로그 시스템**
   - 로그 레벨 (INFO, WARNING, ERROR)
   - 로그 로테이션
   - 디버그 정보 포함

2. **성능 최적화**
   - API 호출 캐싱
   - 병렬 처리 가능성
   - 메모리 사용량 모니터링

3. **사용자 경험**
   - 진행 상황 표시
   - 상세 에러 메시지
   - 복구 방법 제시

---

## 발견된 이슈

### 코드 검토 결과

#### 1. **환경 검증 미흡** (`src/core/executor.ts` L44-45)
```typescript
await validateEnvironment(workDir, logger);
```
- ✅ 구현됨: Git 설치, Node.js 설치 확인
- ❌ 확인 필요: SSH 키 설정, 권한 검증

#### 2. **에러 메시지 일관성**
- Phase 1: "Phase 1 결과 파싱 실패" (rawOutput 포함)
- Phase 2: "Phase 2 결과 파싱 실패" (상세 정보 부족)
- Phase 3: 에러 처리 로직이 다름

#### 3. **Notion API vs MCP 분기 복잡성** (`src/core/executor.ts` L66-143)
- 두 가지 방식 중복 구현
- 향후 유지보수 어려움
- 테스트 커버리지 2배 필요

#### 4. **커스텀 프롬프트 에러 처리** (`src/core/executor.ts` L156-165)
```typescript
const promptFile = path.join(PROMPTS_DIR, `${jobName}.md`);
if (!(await fs.pathExists(promptFile))) {
  throw new Error(`커스텀 프롬프트 파일이 존재하지 않습니다: ${promptFile}`);
}
```
- ✅ 파일 존재 확인함
- ❌ 파일 읽기 오류 처리 없음

#### 5. **보안: rawOutput 로깅** (`src/core/executor.ts` L188-190)
```typescript
const { rawOutput: __, ...logSafeWork } = workRunnerResult;
```
- ✅ 민감한 rawOutput 제거함
- ⚠️ 다른 곳에서 rawOutput 로깅 가능성 확인 필요

---

## 향후 테스트 개선 계획

### Phase 1: 기초 테스트 구축 (1-2주)

#### 목표: Jest 기반 Unit 테스트 프레임워크 도입

**1.1 테스트 환경 구성**
```bash
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev @testing-library/node
```

**1.2 테스트 대상 (우선순위순)**

| 파일 | 테스트 항목 | 예상 케이스 |
|------|-----------|-----------|
| `src/core/cli-runner.ts` | parseTimeout() | 5개 (s, m, h, 기본값, 오류) |
| `src/core/cli-runner.ts` | sanitizeOutput() | 6개 (API 키, 토큰, 마스킹) |
| `src/utils/markdown.ts` | JSON 추출 | 4개 (정상, 코드블록, 없음) |
| `src/config.ts` | loadConfig() | 3개 (정상, 파일없음, 파싱오류) |
| `src/jobs.ts` | getJob() | 3개 (존재, 없음, 파싱오류) |

**1.3 테스트 작성 예시**
```typescript
// src/core/cli-runner.test.ts
describe('parseTimeout', () => {
  test('파싱: "30m" → 1800000ms', () => {
    expect(parseTimeout('30m')).toBe(1800000);
  });

  test('파싱: "1h" → 3600000ms', () => {
    expect(parseTimeout('1h')).toBe(3600000);
  });

  test('기본값: 잘못된 형식', () => {
    expect(parseTimeout('invalid')).toBe(30 * 60 * 1000);
  });
});

describe('sanitizeOutput', () => {
  test('OpenAI API 키 마스킹', () => {
    const output = 'sk-proj-a1b2c3d4e5f6g7h8i9j0k1l2m3n4';
    expect(sanitizeOutput(output)).toContain('sk-***');
  });
});
```

**1.4 결과 기준**
- 단일 모듈 테스트 커버리지 80% 이상
- 테스트 실행 시간 < 5초

---

### Phase 2: 통합 테스트 (2-3주)

#### 목표: 다양한 시나리오에 대한 E2E 테스트

**2.1 테스트 모드 CLI 구성**
```bash
# 테스트용 설정 디렉토리 별도 관리
TEST_HOME=~/.dailyagent-test dailyagent init
TEST_HOME=~/.dailyagent-test dailyagent register
```

**2.2 시나리오별 테스트**

| 시나리오 | 검증 항목 | 예상 결과 |
|---------|---------|---------|
| **Happy Path** | init → register → run → status | ✅ 성공 |
| **Notion 미설정** | API 토큰 없이 run 시도 | ❌ 명확한 에러 메시지 |
| **작업 없음** | Notion에 대기 작업 없을 때 | ✅ 조기 종료 |
| **Notion API 실패** | 네트워크 실패 시뮬레이션 | ❌ 재시도 또는 명확한 롤백 |
| **Git 실패** | Push 실패 시뮬레이션 | ❌ Notion 업데이트 안함 |
| **타임아웃** | Phase 2 초과 시간 | ❌ 정상 종료 및 상태 저장 |

**2.3 Mock 라이브러리**
```bash
npm install --save-dev @jest/mock-fs mock-http
```

**2.4 결과 기준**
- 모든 주요 시나리오 100% 성공
- 에러 시나리오 80% 이상 검증

---

### Phase 3: CI/CD 통합 (1주)

#### 목표: GitHub Actions 기반 자동 테스트

**3.1 워크플로우 파일** (`.github/workflows/test.yml`)
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
```

**3.2 package.json 스크립트 추가**
```json
{
  "scripts": {
    "test": "jest",
    "test:coverage": "jest --coverage",
    "test:watch": "jest --watch",
    "lint": "eslint src/**/*.ts"
  }
}
```

**3.3 결과 기준**
- 모든 PR에 테스트 자동 실행
- 커버리지 레포트 생성
- 실패 시 머지 차단

---

### Phase 4: 성능 및 부하 테스트 (2-3주)

#### 목표: 대규모 작업 및 동시 실행 검증

**4.1 성능 테스트**
- 1000개 작업 목록 조회 시간
- 대용량 로그 파일 (> 100MB) 읽기
- 메모리 누수 모니터링

**4.2 부하 테스트**
- 동시에 5개 작업 실행
- 24시간 연속 스케줄 실행
- API 요청 속도 측정

**4.3 도구 및 방법**
```bash
npm install --save-dev autocannon clinic
```

**4.4 결과 기준**
- 작업 목록 조회 < 100ms
- 메모리 누수 없음
- 병렬 실행 정확도 100%

---

### Phase 5: 보안 검증 (1주)

#### 목표: 민감한 정보 보호 및 접근 제어 검증

**5.1 보안 테스트 항목**

| 항목 | 검증 내용 |
|------|---------|
| **API 키 마스킹** | 모든 로그에서 API 키 제거 확인 |
| **환경 변수** | 불필요한 환경 변수 전달 확인 |
| **파일 권한** | 설정 파일 권한 (600) 검증 |
| **SQL Injection** | Notion API 쿼리 검증 |
| **Command Injection** | Git 명령어 인젝션 방지 |

**5.2 도구**
```bash
npm install --save-dev snyk npm-audit
npm audit
snyk test
```

**5.3 결과 기준**
- npm audit 결과: 알려진 취약점 0개
- snyk 결과: 심각도 High 이상 0개

---

### Phase 6: 문서화 및 테스트 가이드 (1주)

#### 목표: 테스트 작성 및 실행 가이드 제공

**6.1 생성할 문서**

```
docs/
├── TEST-STATUS.md (현재 파일)
├── TEST-GUIDE.md (새로 작성)
│   ├── 테스트 실행 방법
│   ├── 테스트 작성 가이드
│   ├── Mock 데이터 준비
│   └── 결과 해석
├── TEST-SCENARIOS.md
│   ├── 주요 시나리오
│   ├── 엣지 케이스
│   └── 알려진 제한사항
└── SECURITY-CHECKLIST.md
    ├── 보안 체크리스트
    ├── API 키 관리
    └── 권한 검증
```

**6.2 테스트 커버리지 목표**

| 단계 | 목표 커버리지 | 시기 |
|------|----------|------|
| Phase 1 | 40% | 2주 후 |
| Phase 2 | 70% | 5주 후 |
| Phase 3 | 70% | 6주 후 |
| Phase 4 | 75% | 9주 후 |
| Phase 5 | 80% | 10주 후 |
| Phase 6 | 85% | 11주 후 |

---

## 요약 및 권장사항

### 현재 상태
- ✅ 핵심 기능 구현 완료
- ⚠️ 수동 테스트만 진행 (제한적)
- ❌ 자동화 테스트 프레임워크 부재
- ❌ 에러 처리 및 예외 상황 미검증

### 즉시 조치 필요
1. **Jest 테스트 프레임워크 도입** (우선순위: 🔴 Critical)
2. **Unit 테스트 작성** - cli-runner, config, jobs (우선순위: 🔴 Critical)
3. **Integration 테스트** - 3단계 전체 흐름 (우선순위: 🔴 Critical)
4. **CI/CD 파이프라인** - GitHub Actions (우선순위: 🟠 High)

### 개발 팀 가이드
- 새로운 기능 추가 시 Unit 테스트 필수
- PR 리뷰 시 테스트 커버리지 80% 이상 확인
- 월 1회 보안 검사 실행 (npm audit, snyk)
- 분기별 E2E 테스트 수행

### 리스크 요소
1. **Notion API 변경**: 데이터 구조 변경 시 대규모 리팩토링 필요
2. **Claude Code/Cursor 업데이트**: 출력 형식 변경 시 파싱 로직 수정 필요
3. **Git 호스팅 변경**: GitHub만 지원 중, Gitlab/Gitea 미지원
4. **스케줄링 OS 호환성**: macOS/Linux만 테스트, Windows WSL 상태 불명

---

## 부록: 테스트 환경 셋업

### 사전 요구사항
```bash
# Node.js 18+ 필수
node --version

# Claude Code 설치
npm install -g @anthropic-ai/claude-code

# Cursor Agent 설치 (선택)
npm install -g cursor

# GitHub CLI 설치 (PR 테스트용)
brew install gh  # macOS
sudo apt-get install gh  # Linux
```

### 테스트 실행
```bash
# 수동 테스트
npx ts-node src/test/run-cli.ts
npx ts-node src/test/notion-api.ts

# Unit 테스트 (Phase 1 이후)
npm run test

# 커버리지 리포트
npm run test:coverage

# 특정 테스트 파일만
npm run test -- src/core/cli-runner.test.ts
```

---

**문서 작성**: 2026-02-17
**최종 검토**: 대기 중
**다음 갱신**: Phase 1 테스트 프레임워크 도입 후
