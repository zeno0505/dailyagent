# DailyAgent

AI-powered task automation CLI that integrates with Notion to automate development workflows using Claude Code CLI.

## Tech Stack

- **Node.js / JavaScript** — CLI package (`dailyagent` command)
- **Commander** — CLI framework
- **Inquirer** — Interactive prompts
- **Claude Code CLI** — AI task execution engine
- **Notion MCP Server** — Notion API integration via MCP

## Project Structure

```
package.json                # npm package manifest
bin/
  dailyagent.js             # CLI entrypoint (#!/usr/bin/env node)
src/
  cli.js                    # Commander-based command routing
  config.js                 # Config management (~/.dailyagent/)
  jobs.js                   # Job CRUD + PID locking
  logger.js                 # Timestamped file logger
  commands/
    init.js                 # Interactive setup wizard
    register.js             # Job registration
    list.js                 # Job listing
    run.js                  # Manual job execution
  core/
    prompt-generator.js     # AI prompt template
    claude-runner.js        # Claude CLI wrapper
    executor.js             # Execution orchestrator
templates/
  claude-settings.json      # Claude permission settings template
legacy/                     # Original bash scripts (preserved for reference)
```

## Workflow

1. `dailyagent init` — Configure Notion DB URL and column mappings
2. `dailyagent register` — Register a job (name, working dir, schedule, timeout)
3. `dailyagent run <name>` — Execute: query Notion → Claude Code → Git push → Notion update
4. `dailyagent list` — View registered jobs and their status

## Commands

```bash
# Install globally
npm install -g dailyagent

# Initialize configuration
dailyagent init

# Register a new job
dailyagent register

# List registered jobs
dailyagent list

# Run a job manually
dailyagent run <job-name>
```

## Conventions

- **JavaScript**: CommonJS modules, `'use strict'`, async/await
- **Git**: Branch naming `feature/<type>/<description>` or `fix/<description>`. Conventional Commits (feat:, fix:, docs:, refactor:, test:)
- **Documentation**: Written in Korean (한글)
- **Commits**: English commit messages
- **Notion statuses**: 작업 대기, 진행 중, 완료, 에러, 검토 필요
- **Config location**: `~/.dailyagent/` (config, jobs, logs, locks)

## Key Files

- `src/core/executor.js` — Orchestrator: environment validation → lock → prompt → Claude → result → unlock
- `src/core/prompt-generator.js` — 7-step AI prompt template (ported from bash)
- `src/core/claude-runner.js` — Spawns `claude -p` with stdin prompt, JSON output, timeout
- `src/config.js` — Manages `~/.dailyagent/dailyagent.config.json`
- `src/jobs.js` — Manages `~/.dailyagent/jobs.json` with PID-based locking

## Important Notes

- SSH key auth required for Git push operations
- Sensitive config via environment variables (never commit `.env`)
- Notion DB requires specific properties: 제목, 상태, 우선순위, 기준 브랜치, 작업 브랜치, 커밋 해시, 선행 작업, 완료 시간
- Legacy bash scripts preserved in `legacy/` for reference
