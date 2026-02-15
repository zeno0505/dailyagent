# DailyAgent 프로젝트 현황 분석

> 분석일: 2026-02-15

## 1. 프로젝트 개요

DailyAgent는 Notion 데이터베이스와 연동하여 개발 작업을 자동화하는 CLI 도구입니다.
Claude Code CLI를 AI 실행 엔진으로 사용하여, Notion에 등록된 작업을 자동으로 수행하고 결과를 업데이트합니다.

- **버전**: 0.1.0 (MVP)
- **라이선스**: MIT
- **런타임**: Node.js (CommonJS)

## 2. 디렉토리 구조

```
dailyagent/
├── bin/
│   └── dailyagent.js              # CLI 진입점 (#!/usr/bin/env node, 7줄)
├── src/
│   ├── cli.js                     # Commander 기반 명령어 라우팅 (45줄)
│   ├── config.js                  # 설정 관리 ~/.dailyagent/ (59줄)
│   ├── jobs.js                    # Job CRUD + PID 기반 잠금 (113줄)
│   ├── logger.js                  # 타임스탬프 파일 로거 (57줄)
│   ├── commands/
│   │   ├── init.js                # 대화형 설정 초기화 위저드 (114줄)
│   │   ├── register.js            # 작업 등록 (82줄)
│   │   ├── list.js                # 작업 목록 조회 - 테이블 형식 (69줄)
│   │   └── run.js                 # 수동 작업 실행 (58줄)
│   └── core/
│       ├── executor.js            # 실행 오케스트레이터 (122줄)
│       ├── claude-runner.js       # Claude CLI 래퍼 - spawn, stdin, timeout (101줄)
│       └── prompt-generator.js    # 7단계 AI 프롬프트 템플릿 (148줄)
├── templates/
│   └── claude-settings.json       # Claude 권한 설정 템플릿
├── legacy/                        # 원본 bash 스크립트 (참조용 보존)
│   ├── notion-cron-job.sh         # 원본 자동화 스크립트
│   ├── claude-automation-settings.json
│   ├── install-launchd.sh / uninstall-launchd.sh  # macOS LaunchDaemon
│   ├── com.fanding.notion-cron.plist
│   ├── cronicle/                  # WSL 환경 스케줄링
│   │   ├── plugins/notion-automation.js
│   │   ├── install-cronicle.sh / install-cronicle-manual.sh
│   │   ├── register-notion-job.sh
│   │   ├── setup-cronicle-service.sh
│   │   └── cronicle-config.json
│   └── *.md                       # 각종 문서 (README, QUICKSTART 등)
├── docs/                          # 프로젝트 문서
├── CLAUDE.md                      # Claude Code 프로젝트 지시사항
├── .mcp.json                      # MCP 서버 설정 (Notion HTTP)
├── .gitignore
├── package.json
└── package-lock.json
```

**소스 코드 규모**: 총 약 830줄 (중복 제외, src/ + bin/)

## 3. 핵심 모듈별 분석

### 3.1 CLI 계층 (`bin/`, `src/cli.js`)

| 명령어 | 설명 | 상태 |
|--------|------|------|
| `dailyagent init` | Notion DB URL, 컬럼 매핑 설정 | 구현 완료 |
| `dailyagent register` | 작업 등록 (이름, 디렉토리, 스케줄, 타임아웃) | 구현 완료 |
| `dailyagent list` | 등록된 작업 목록 조회 | 구현 완료 |
| `dailyagent run <name>` | 지정 작업 즉시 실행 | 구현 완료 |

### 3.2 설정 관리 (`src/config.js`)

- **설정 디렉토리**: `~/.dailyagent/`
- **설정 파일**: `dailyagent.config.json`
- **하위 디렉토리**: `logs/` (로그), `locks/` (PID 잠금)
- Notion 연동 컬럼 매핑 지원: 상태, 우선순위, 기준 브랜치, 작업 브랜치
- 기본 상태값: 작업 대기 → 검토 전

### 3.3 작업 관리 (`src/jobs.js`)

- `~/.dailyagent/jobs.json`에 작업 정보 저장
- **CRUD 기능**: addJob, getJob, listJobs, updateJob, removeJob
- **PID 기반 잠금**: acquireLock / releaseLock
  - stale lock 자동 감지: 프로세스 존재 여부 확인 (`process.kill(pid, 0)`)
  - 비정상 종료 시 잠금 자동 해제

### 3.4 실행 엔진 (`src/core/`)

**executor.js** — 오케스트레이터 (8단계 파이프라인):
1. 설정/작업 로드
2. 환경 검증 (디렉토리 존재, Git 저장소, Claude CLI 설치)
3. PID 잠금 획득
4. 프롬프트 생성
5. Claude 설정 파일 해석
6. Claude Code 실행
7. 작업 메타데이터 업데이트 (성공/실패)
8. 잠금 해제 (finally 블록)

**claude-runner.js** — Claude CLI 래퍼:
- 실행 명령: `claude -p --output-format json --no-session-persistence --dangerously-skip-permissions`
- stdin으로 프롬프트 전달, stdout으로 JSON 결과 수신
- 타임아웃 처리: 설정 가능 (기본 30분), `s/m/h` 단위 지원
- 비-JSON 응답 시 `{ raw_output, exit_code }` 형태로 fallback

**prompt-generator.js** — 7단계 AI 프롬프트 템플릿:
1. Notion 데이터베이스 조회 (MCP `notion-query-database-view`)
2. 작업 상세 내용 확인 (MCP `notion-fetch`)
3. Git 작업 준비 (브랜치 생성)
4. 작업 수행 (코드 작성, 커밋)
5. Git Push
6. Notion 업데이트 (MCP `notion-update-page`)
7. JSON 결과 보고

### 3.5 로깅 (`src/logger.js`)

- 파일 기반 로깅: `~/.dailyagent/logs/{jobName}-{timestamp}.log`
- 로그 레벨: INFO, WARN, ERROR, DEBUG
- 콘솔 동시 출력 (DEBUG 제외)
- 타임스탬프 형식: `[YYYY-MM-DD HH:MM:SS]`

### 3.6 의존성

| 패키지 | 버전 | 용도 |
|--------|------|------|
| commander | ^12.1.0 | CLI 프레임워크 |
| inquirer | ^8.2.6 | 대화형 프롬프트 |
| chalk | ^4.1.2 | 터미널 색상 출력 |
| ora | ^5.4.1 | 스피너 애니메이션 |
| fs-extra | ^11.2.0 | 파일 시스템 유틸리티 |

## 4. 현재 작업 현황

### 4.1 Git 커밋 히스토리 (최신순)

| 해시 | 메시지 | 비고 |
|------|--------|------|
| `4348190` | fix: 프롬프트 개선 | 최신 (main HEAD) |
| `aaa08d1` | fix: init 과정에서 timeout / agent 설정 제거 | |
| `b36822b` | fix: init 과정에서 기준 브랜치 제거 및 불필요한 코드 정리 | |
| `ec5d5f7` | feat: 작업 브랜치를 입력받을 수 있도록 개선 | |
| `2af7d32` | feat: MVP 최소구현 | 핵심 기능 구현 |
| `17332ac` | feat: WSL 대응을 위한 cronicle 추가 | |
| `8124f39` | fix: 선행 작업 관련 prompt 추가 | |
| `0317e43` | fix: 상태명 변경 | |
| `2803e50` | Initial Commit | 최초 커밋 |

### 4.2 구현 완료 기능

- CLI 기본 구조 (init, register, list, run 4개 명령어)
- Notion 연동 설정 및 컬럼 매핑 (대화형 위저드)
- 작업 CRUD + PID 기반 잠금 (동시 실행 방지)
- Claude Code CLI 실행 및 타임아웃 처리
- 7단계 자동화 프롬프트 템플릿 (Notion → Claude → Git → Notion)
- 파일 기반 타임스탬프 로깅
- Claude 권한 설정 템플릿 (templates/claude-settings.json)
- MCP 서버 설정 (.mcp.json — Notion HTTP 연동)
- WSL 환경 대응 (legacy/cronicle/)

### 4.3 프로젝트 성숙도

현재 **MVP 단계**입니다. 핵심 워크플로우(Notion 조회 → Claude 실행 → Git Push → Notion 업데이트)는 동작하지만, 아래 영역에서 개선이 필요합니다:

| 영역 | 현재 상태 | 비고 |
|------|----------|------|
| 테스트 코드 | 없음 | 단위 테스트, 통합 테스트 미작성 |
| 에러 복구 | 기본 수준 | 부분 실패 시 롤백 메커니즘 부재 |
| 작업 삭제/수정 | 내부 함수만 존재 | jobs.js에 removeJob 있으나 CLI 미노출 |
| 스케줄링 | legacy 의존 | 네이티브 cron/스케줄러 연동 미구현 |
| 설정 수정 | init만 가능 | 개별 설정 변경 CLI 미제공 |
| 로그 관리 | 축적만 됨 | 로그 로테이션/정리 기능 없음 |
| 작업 브랜치 입력 | 구현 완료 | 최근 추가된 기능 |

## 5. 기술 스택 요약

```
Runtime:       Node.js (CommonJS, 'use strict')
CLI:           Commander v12 + Inquirer v8
AI Engine:     Claude Code CLI (claude -p --output-format json)
Integration:   Notion MCP Server (HTTP — mcp.notion.com)
VCS:           Git (SSH 인증)
Scheduling:    Cronicle (WSL 환경, legacy)
Config:        ~/.dailyagent/ (JSON 파일 기반)
Logging:       자체 파일 로거 (타임스탬프, 레벨별)
```

## 6. 파일별 코드 규모

| 파일 | 줄 수 | 역할 |
|------|-------|------|
| `src/core/prompt-generator.js` | 148 | 프롬프트 템플릿 (가장 큰 파일) |
| `src/core/executor.js` | 122 | 실행 오케스트레이터 |
| `src/commands/init.js` | 114 | 설정 초기화 |
| `src/jobs.js` | 113 | 작업 관리 + 잠금 |
| `src/core/claude-runner.js` | 101 | Claude CLI 래퍼 |
| `src/commands/register.js` | 82 | 작업 등록 |
| `src/commands/list.js` | 69 | 작업 목록 |
| `src/config.js` | 59 | 설정 관리 |
| `src/commands/run.js` | 58 | 작업 실행 |
| `src/logger.js` | 57 | 로깅 |
| `src/cli.js` | 45 | CLI 라우팅 |
| `bin/dailyagent.js` | 7 | 진입점 |
| **합계** | **~975** | |
