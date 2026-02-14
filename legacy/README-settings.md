# Claude 자동화 설정 가이드

## 설정 파일: `claude-automation-settings.json`

이 파일은 Claude Code가 자동화 모드에서 실행될 때 어떤 도구를 사용할 수 있는지 제어합니다.

## 현재 설정 내용

```json
{
  "permissionMode": "auto",
  "allowedTools": [
    "Bash(git *)",
    "Bash(cd *)",
    "Bash(ls *)",
    "Bash(cat *)",
    "Read",
    "Write",
    "Edit",
    "StrReplace",
    "Grep",
    "Glob",
    "LS",
    "Shell",
    "CallMcpTool",
    "CallMcpTool(user-Notion, *)",
    "CallMcpTool(user-Notion, notion-query-database-view)",
    "CallMcpTool(user-Notion, notion-fetch)",
    "CallMcpTool(user-Notion, notion-update-page)",
    "CallMcpTool(user-Notion, notion-create-pages)",
    "CallMcpTool(user-Notion, notion-create-comment)",
    "CallMcpTool(user-Notion, notion-search)",
    "FetchMcpResource",
    "FetchMcpResource(user-Notion, *)"
  ],
  "disallowedTools": [
    "Bash(rm -rf *)",
    "Bash(sudo *)",
    "Delete"
  ]
}
```

## 설정 항목 설명

### permissionMode

Claude가 권한을 처리하는 방식:

- `"auto"`: 허용된 도구는 자동 승인, 나머지는 차단
- `"plan"`: 계획 단계에서만 권한 확인
- `"strict"`: 모든 작업에 대해 확인 (자동화에 부적합)

### allowedTools

자동으로 승인되는 도구 목록:

| 도구 | 설명 | 사용 예시 |
|-----|------|---------|
| `Bash(git *)` | 모든 git 명령 | `git status`, `git commit`, `git push` |
| `Bash(cd *)` | 디렉토리 이동 | `cd ~/dev/web-temp` |
| `Bash(ls *)` | 파일 목록 조회 | `ls -la` |
| `Bash(cat *)` | 파일 내용 보기 | `cat package.json` |
| `Read` | 파일 읽기 | 코드 분석 |
| `Write` | 파일 생성 | 새 파일 작성 |
| `Edit` | 파일 수정 | 기존 파일 편집 |
| `StrReplace` | 문자열 교체 | 코드 수정 |
| `Grep` | 코드 검색 | 패턴 찾기 |
| `Glob` | 파일 패턴 매칭 | `*.js` 파일 찾기 |
| `LS` | 디렉토리 탐색 | 프로젝트 구조 확인 |
| `CallMcpTool` | 모든 MCP 도구 호출 | 일반 MCP 사용 |
| `CallMcpTool(notion, *)` | Notion MCP 모든 도구 | Notion 전체 작업 |
| `CallMcpTool(notion, notion-query-database-view)` | 데이터베이스 조회 | Notion DB 읽기 |
| `CallMcpTool(notion, notion-fetch)` | 페이지 가져오기 | Notion 페이지 읽기 |
| `CallMcpTool(notion, notion-update-page)` | 페이지 업데이트 | Notion 페이지 쓰기 |
| `CallMcpTool(notion, notion-create-pages)` | 페이지 생성 | 새 Notion 페이지 |
| `CallMcpTool(user-Notion, *)` | Notion MCP (대체 이름) | Notion 전체 작업 |
| `FetchMcpResource` | MCP 리소스 읽기 | MCP 문서 접근 |
| `FetchMcpResource(notion, *)` | Notion 리소스 접근 | Notion 문서/스키마 |
| `Shell` | 셸 명령 실행 | 빌드, 테스트 등 |

**참고**: Notion MCP 서버는 환경에 따라 `notion` 또는 `user-Notion`이라는 이름으로 나타날 수 있습니다. 설정 파일은 두 가지 모두 포함하여 호환성을 보장합니다.

### disallowedTools

명시적으로 차단되는 위험한 도구:

| 도구 | 이유 |
|-----|------|
| `Bash(rm -rf *)` | 파일 삭제 방지 |
| `Bash(sudo *)` | 권한 상승 방지 |

## 커스터마이징

### 더 많은 권한 허용

npm, yarn 등의 패키지 매니저를 사용해야 한다면:

```json
{
  "allowedTools": [
    // ... 기존 도구들 ...
    "Bash(npm *)",
    "Bash(yarn *)",
    "Bash(pnpm *)"
  ]
}
```

### 더 제한적으로 설정

파일 쓰기를 제한하고 읽기만 허용:

```json
{
  "allowedTools": [
    "Bash(git status)",
    "Bash(git log *)",
    "Read",
    "Grep",
    "Glob",
    "LS",
    "CallMcpTool"
  ],
  "disallowedTools": [
    "Write",
    "Edit",
    "StrReplace",
    "Bash(git commit *)",
    "Bash(git push *)"
  ]
}
```

### 특정 git 작업만 허용

커밋은 허용하되 push는 차단:

```json
{
  "allowedTools": [
    "Bash(git status)",
    "Bash(git add *)",
    "Bash(git commit *)",
    "Bash(git log *)"
  ],
  "disallowedTools": [
    "Bash(git push *)",
    "Bash(git force *)"
  ]
}
```

## 권한 패턴 매칭 규칙

Claude Code는 다음과 같은 패턴을 지원합니다:

- `*`: 모든 것과 매칭
- `Bash(git *)`: git으로 시작하는 모든 bash 명령
- `Read`: Read 도구 전체
- `Bash(git commit *)`: `git commit`으로 시작하는 모든 명령

## 설정 변경 후

1. **launchd 사용 시**: 자동으로 새 설정 적용됨 (재시작 불필요)
2. **수동 실행 시**: 즉시 적용됨

## 문제 해결

### 작업이 차단되는 경우

로그에서 차단된 도구 확인:

```bash
tail -100 ~/scripts/logs/launchd-stderr.log | grep "permission"
```

필요한 도구를 `allowedTools`에 추가하세요.

### 너무 많은 권한을 주고 싶지 않은 경우

1. 테스트 실행으로 필요한 도구 확인:
```bash
./notion-cron-job.sh
```

2. 로그에서 사용된 도구 확인
3. 필요한 도구만 `allowedTools`에 추가

### 설정 파일 검증

```bash
# JSON 유효성 확인
cat claude-automation-settings.json | jq .

# 또는 Python으로
python3 -m json.tool claude-automation-settings.json
```

## 보안 권장사항

### ✅ 안전한 설정

- 필요한 도구만 명시적으로 허용
- 위험한 명령(`rm -rf`, `sudo`)은 차단
- `disallowedTools`로 추가 보호층 생성

### ⚠️ 주의할 설정

- `"permissionMode": "strict"` - 자동화에 부적합 (입력 대기)
- 모든 Bash 명령 허용 - 위험할 수 있음
- `disallowedTools` 없음 - 안전망 없음

### ❌ 피해야 할 설정

- `--dangerously-skip-permissions` 단독 사용
- 설정 파일 없이 실행
- `allowedTools` 없이 `permissionMode: "auto"` 사용

## 예시: 프로덕션 환경

매우 제한적이지만 안전한 설정:

```json
{
  "permissionMode": "auto",
  "allowedTools": [
    "Bash(git status)",
    "Bash(git checkout -b feature/*)",
    "Bash(git add .)",
    "Bash(git commit -m *)",
    "Bash(git push -u origin feature/*)",
    "Read",
    "Write",
    "Edit",
    "StrReplace",
    "Grep",
    "Glob",
    "LS",
    "CallMcpTool(user-Notion, notion-query-database-view)",
    "CallMcpTool(user-Notion, notion-fetch)",
    "CallMcpTool(user-Notion, notion-update-page)"
  ],
  "disallowedTools": [
    "Bash(rm *)",
    "Bash(sudo *)",
    "Bash(git push -f *)",
    "Bash(git reset --hard *)",
    "Delete"
  ]
}
```

## 참고 자료

- [Claude Code 권한 문서](https://code.claude.com/docs/ko/permissions)
- [CLI 참조](https://code.claude.com/docs/ko/cli-reference)
- 프로젝트 README: `README-cron.md`
