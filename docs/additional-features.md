# DailyAgent 추가 기능사항 정리

> 기획 문서(최초 기획안, 구현 정리, 아이디어 고민, 에픽 컬럼 추가)와 현재 코드베이스를 비교 분석하여 추가로 필요한 기능들을 정리한 문서입니다.

## 현재 구현 현황

### 구현 완료된 기능

| 기능 | 파일 | 설명 |
|------|------|------|
| `dailyagent init` | `src/commands/init.js` | Notion DB URL, 컬럼명 설정 위저드 |
| `dailyagent register` | `src/commands/register.js` | 작업 등록 (이름, 에이전트, 디렉토리, 스케줄, 타임아웃) |
| `dailyagent list` | `src/commands/list.js` | 등록된 작업 목록 테이블 출력 |
| `dailyagent run <name>` | `src/commands/run.js` | 즉시 실행 + 스피너 |
| 설정 관리 | `src/config.js` | `~/.dailyagent/` 디렉토리 및 config JSON 관리 |
| 작업 관리 | `src/jobs.js` | jobs.json CRUD + PID 기반 잠금 |
| 로거 | `src/logger.js` | 타임스탬프 파일/콘솔 로깅 |
| 프롬프트 생성기 | `src/core/prompt-generator.js` | 7단계 AI 프롬프트 템플릿 |
| Claude 실행기 | `src/core/claude-runner.js` | `claude -p` 래퍼 (stdin, timeout, JSON 파싱) |
| 실행 오케스트레이터 | `src/core/executor.js` | 검증 → 잠금 → 프롬프트 → Claude → 결과 |

---

## 추가 필요 기능

### P1 - 우선순위 높음 (핵심 기능)

#### 1. `dailyagent unregister <name>` - 작업 삭제

- **출처**: 최초 기획안, 구현 정리
- **설명**: 등록된 작업을 삭제하는 커맨드
- **상세**:
  - `jobs.json`에서 해당 작업 제거
  - OS 스케줄러(cron/launchd)에서도 해당 스케줄 제거
  - 삭제 전 확인 프롬프트 표시
  - 관련 로그 파일 삭제 여부 선택
- **참고**: `jobs.js`에 `removeJob()` 함수는 이미 구현되어 있으나 CLI 커맨드가 없음

#### 2. 에러 시 Notion 페이지 상태 업데이트

- **출처**: 구현 정리, 프롬프트 템플릿
- **설명**: 작업 실패 시 Notion 페이지 상태를 "에러" 또는 "검토 필요"로 업데이트
- **상세**:
  - 현재 `executor.js`에서 에러 시 `jobs.json`만 업데이트하고 Notion은 미처리
  - 프롬프트 내에 에러 처리 단계가 있으나, Claude 자체가 실패하면 Notion 업데이트 불가
  - executor 레벨에서 직접 Notion API를 호출하여 에러 상태 반영 필요

#### 3. 설정 수정 기능 (`dailyagent config`)

- **출처**: 작업 요구사항 ("설정 수정 및 삭제 기능이 필요")
- **설명**: 초기화 이후 설정을 개별적으로 수정할 수 있는 커맨드
- **상세**:
  - `dailyagent config set <key> <value>` - 개별 설정값 변경
  - `dailyagent config get <key>` - 설정값 조회
  - `dailyagent config list` - 전체 설정 출력
  - `dailyagent config reset` - 초기화 (init 재실행과 동일)

#### 4. `claude-settings.json` 경로 관리 개선

- **출처**: 구현 정리
- **설명**: Claude Code 권한 설정 파일 경로를 config에서 관리
- **상세**:
  - 현재 `executor.js`에서 패키지 내 `templates/` 경로만 검색
  - config에 `claude_settings_path` 필드 추가
  - 작업별로 다른 설정 파일 사용 가능하도록 개선

### P2 - 우선순위 중간 (편의 기능)

#### 5. `dailyagent status <name>` - 작업 상태 조회

- **출처**: 구현 정리
- **설명**: 특정 작업의 상태, 마지막 실행 결과, 실행 이력 조회
- **상세**:
  - 작업 설정 정보 (디렉토리, 스케줄, 타임아웃)
  - 마지막 실행 시간, 상태, 소요 시간
  - 최근 N회 실행 이력

#### 6. `dailyagent logs <name>` - 로그 조회

- **출처**: 최초 기획안, 구현 정리
- **설명**: 특정 작업의 로그 파일 조회
- **상세**:
  - 최근 로그 출력 (tail 기능)
  - `--follow` 옵션으로 실시간 로그 모니터링
  - 로그 파일 목록 조회
  - 오래된 로그 자동 정리 (retention 설정)

#### 7. 스케줄러 연동

- **출처**: 최초 기획안, 구현 정리
- **설명**: OS 스케줄러와 연동하여 자동 실행
- **상세**:
  - WSL/Linux: crontab 자동 등록/해제
  - macOS: launchd plist 자동 생성/등록
  - `dailyagent schedule start` - 스케줄러 활성화
  - `dailyagent schedule stop` - 스케줄러 비활성화
  - `dailyagent schedule status` - 스케줄러 상태 확인
- **고려사항**:
  - 기기 수면 모드 시 밀린 작업 처리 정책
  - Missed 작업 감지 및 표시
  - 환경 변수 로딩 (.zshrc, .bashrc)

#### 8. 작업 일시 중지 / 재개

- **출처**: 아이디어 고민
- **설명**: 토큰 비용 문제 등으로 특정 작업을 일시 중지하거나 재개
- **상세**:
  - `dailyagent pause <name>` - 작업 일시 중지
  - `dailyagent resume <name>` - 작업 재개
  - jobs.json에 `status: 'paused'` 상태 추가
  - 스케줄러가 paused 상태의 작업은 건너뛰도록 처리

#### 9. 에이전트/모델 설정 확장

- **출처**: 아이디어 고민, 최초 기획안
- **설명**: Claude Code 외 다른 에이전트 지원 및 모델 설정
- **상세**:
  - 작업별 모델 지정 (비용 최적화)
  - 현재 `register`에서 에이전트 선택이 `claude-code`만 가능
  - 향후 Cursor CLI 등 추가 에이전트 대비 인터페이스 설계
  - `claude-runner.js`에 `--model` 옵션 전달 지원

### P3 - 우선순위 낮음 (장기 개선)

#### 10. 에픽 단위 작업 관리

- **출처**: 에픽 컬럼 추가
- **설명**: 에픽(상위 작업) 단위로 하위 작업들을 묶어서 관리
- **상세**:
  - Notion DB에 에픽 컬럼 추가 지원
  - 에픽 내 하위 작업 순서대로 자동 실행
  - 현재 "선행 작업" 관계(relation)를 활용한 의존성 체인 자동 실행

#### 11. 단위 테스트 작성

- **출처**: 구현 정리
- **설명**: 핵심 모듈 단위 테스트
- **대상**:
  - `config.js` - 설정 로드/저장
  - `jobs.js` - CRUD, 잠금 로직
  - `prompt-generator.js` - 프롬프트 생성
  - `claude-runner.js` - 타임아웃 파싱
  - `executor.js` - 오케스트레이션 흐름

#### 12. 설치 스크립트 및 npm publish

- **출처**: 최초 기획안, 구현 정리
- **설명**: 간편 설치 및 npm 배포
- **상세**:
  - `curl -fsSL` 원라인 설치 스크립트
  - npm publish 준비 (README, LICENSE)
  - GitHub Release 자동화

#### 13. 알림 연동

- **출처**: 구현 정리
- **설명**: 작업 완료/실패 시 알림 전송
- **상세**:
  - Slack webhook 연동
  - Discord webhook 연동
  - Telegram bot 연동
  - 알림 설정을 config에서 관리

#### 14. 웹 대시보드

- **출처**: 구현 정리
- **설명**: 작업 현황과 로그를 웹으로 조회
- **상세**:
  - 작업 목록/상태 뷰
  - 로그 뷰어
  - 실행 이력 차트

#### 15. Self-Health Check

- **출처**: 최초 기획안
- **설명**: 좀비 스케줄러 방지 및 시스템 건강 확인
- **상세**:
  - 실행 시 등록된 작업들의 유효성 체크
  - 작업 디렉토리 존재 여부 확인
  - 스케줄러 등록 상태와 jobs.json 동기화 확인
  - 비정상적으로 종료된 잠금 파일 정리 (이미 부분 구현됨)

---

## 현재 코드에서 발견된 개선 필요사항

### 코드 품질

| 항목 | 파일 | 설명 |
|------|------|------|
| E2E 테스트 | 전체 | Notion MCP 연동 포함 실제 E2E 테스트 부재 |
| 에러 핸들링 | `executor.js` | Claude 실패 시 Notion 상태 업데이트 미구현 |
| 설정 경로 | `executor.js` | `claude-settings.json` 경로 하드코딩 |

### 기능 갭

| 기획 항목 | 현재 상태 | 비고 |
|-----------|-----------|------|
| `unregister` 커맨드 | 미구현 | `removeJob()` 함수만 존재 |
| `status` 커맨드 | 미구현 | |
| `logs` 커맨드 | 미구현 | 로그 파일은 생성됨 |
| 스케줄러 연동 | 미구현 | `schedule` 필드만 저장 |
| 에이전트 다중 지원 | 미구현 | `claude-code`만 선택 가능 |
| 모델 설정 | 미구현 | |
| 설정 수정/삭제 | 미구현 | `init` 재실행만 가능 |

---

## 권장 구현 순서

1. **Phase 1** (즉시): `unregister`, `config` 커맨드, 에러 시 Notion 업데이트
2. **Phase 2** (단기): `status`, `logs` 커맨드, settings 경로 관리
3. **Phase 3** (중기): 스케줄러 연동, 작업 일시 중지/재개, 에이전트 설정
4. **Phase 4** (장기): 에픽 관리, 테스트, npm publish, 알림, 대시보드
