import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { isInitialized, PROMPTS_DIR } from '../config.js';
import { addJob } from '../jobs.js';
import { listWorkspaces } from '../workspace.js';
import type { ExecutionConfig, Phase2Mode, PromptMode } from '../types/jobs.js';
import { Agent } from '../utils/cli-runner.js';
import { validateAgentModel } from '../utils/register.js';

export async function registerCommand (): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  console.log(chalk.bold('\n  새 작업 등록\n'));

  // Workspace 선택
  const workspaces = await listWorkspaces();
  if (workspaces.length === 0) {
    console.log(chalk.red('등록된 Workspace가 없습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  const workspace = await select({
    message: 'Workspace 선택:',
    choices: workspaces.map(ws => ({
      name: ws.name,
      value: ws.name,
    })),
    default: workspaces[0]?.name,
  });

  const name = await input({
    message: '작업 이름 (영문, 하이픈 허용):',
    validate: (val) => {
      if (!val) return '작업 이름을 입력해주세요.';
      if (!/^[a-z0-9-]+$/.test(val)) return '영문 소문자, 숫자, 하이픈만 사용 가능합니다.';
      return true;
    },
  });

  const agent = await select<Agent>({
    message: 'AI 에이전트:',
    choices: [
      { name: 'Claude Code CLI', value: 'claude-code' as const },
      { name: 'Cursor CLI', value: 'cursor' as const },
    ],
    default: 'claude-code',
  });

  const model = await input({
    message: '모델 (선택사항, 비용 최적화용 - 비워두면 기본값 사용):',
    default: '',
    validate: (model) => validateAgentModel(agent, model),
  });  

  const schedule = await input({
    message: 'Cron 스케줄 (후속 작업용, 예: 0 */5 * * *):',
    default: '0 */5 * * *',
  });

  const timeout = await input({
    message: '타임아웃 (예: 30m, 1h):',
    default: '30m',
  });

  const prompt_mode = await select<PromptMode>({
    message: '프롬프트 모드:',
    choices: [
      { name: '기본 프롬프트 사용 (내장 템플릿)', value: 'default' },
      { name: '커스텀 프롬프트 사용 (직접 작성)', value: 'custom' },
    ],
    default: 'default',
  });

  let execution_config: ExecutionConfig | undefined;
  if (prompt_mode === "default") {
    const phase2_mode = await select<Phase2Mode>({
      message: '실행 모드:',
      choices: [
        { name: '단일 실행 (한 세션에서 모든 작업이 수행됩니다.)', value: 'single' as const },
        { name: '분할 실행 (각 작업을 별도의 세션에서 수행됩니다.)', value: 'session' as const },
      ],
      default: 'single',
    });

    if (phase2_mode === 'session') {
      const phase2_plan_model = await input({
        message: '계획 단계 모델(Phase-2-1):',
        default: agent === 'claude-code' ? 'opus' : 'opus-4.5-thinking',
        validate: (model) => validateAgentModel(agent, model),
      });
      const phase2_impl_model = await input({
        message: '구현 단계 모델(Phase-2-2):',
        default: agent === 'claude-code' ? 'haiku' : 'auto',
        validate: (model) => validateAgentModel(agent, model),
      });
      const phase2_review_model = await input({
        message: '검토 단계 모델(Phase-2-3):',
        default: agent === 'claude-code' ? 'sonnet' : 'sonnet-4.5-thinking',
        validate: (model) => validateAgentModel(agent, model),
      });
      const phase2_plan_timeout = await input({
        message: '계획 단계 타임아웃(예: 30m, 1h):',
        default: '10m',
      });
      const phase2_review_timeout = await input({
        message: '검토 단계 타임아웃(예: 30m, 1h):',
        default: '10m',
      });
      execution_config = {
        phase2_mode,
        phase2_plan_model,
        phase2_impl_model,
        phase2_review_model,
        phase2_plan_timeout,
        phase2_review_timeout,
      };
    }
  }

  try {
    // 커스텀 프롬프트 파일 생성
    if (prompt_mode === 'custom') {
      await fs.ensureDir(PROMPTS_DIR);
      const promptFile = path.join(PROMPTS_DIR, `${name}.md`);

      if (await fs.pathExists(promptFile)) {
        console.log(chalk.yellow(`\n  기존 프롬프트 파일이 존재합니다: ${promptFile}`));
      } else {
        const defaultPromptContent = `# ${name} 커스텀 프롬프트

## 작업 정보
아래 변수들은 실행 시 자동으로 치환됩니다:
- \`{{workDir}}\` — 작업 디렉토리
- \`{{taskInfo}}\` — Notion에서 가져온 작업 정보 (JSON)

## 프롬프트 내용
여기에 AI 에이전트에게 전달할 프롬프트를 작성하세요.

현재 작업 디렉토리: {{workDir}}

### 작업 정보
\`\`\`json
{{taskInfo}}
\`\`\`

### 수행할 작업
(여기에 구체적인 작업 내용을 작성하세요)

## 결과 출력
반드시 아래 JSON 형식으로만 결과를 반환하세요. 다른 텍스트 없이 JSON만 출력:
\`\`\`json
{
  "branch_name": "작업한 브랜치명",
  "commits": [
    { "hash": "커밋해시", "message": "커밋메시지" }
  ],
  "files_changed": ["파일1", "파일2"],
  "summary": "작업 요약",
  "pr_url": "PR URL 또는 null",
  "pr_skipped_reason": "PR 생성을 건너뛴 이유 또는 null"
}
\`\`\`
`;
        await fs.writeFile(promptFile, defaultPromptContent, 'utf8');
        console.log(chalk.cyan(`\n  프롬프트 파일이 생성되었습니다: ${promptFile}`));
        console.log(chalk.gray(`  파일을 수정하여 커스텀 프롬프트를 작성하세요.`));
      }
    }

    await addJob({
      name,
      agent,
      prompt_mode,
      schedule,
      timeout,
      workspace,
      ...(model && { model }),
      ...(execution_config && { execution: execution_config }),
    });

    console.log('');
    console.log(chalk.green(`  작업 "${name}"이(가) 등록되었습니다!`));
    console.log('');
    console.log(`  실행: ${chalk.cyan(`dailyagent run ${name}`)}`);
    if (prompt_mode === 'custom') {
      const promptFile = path.join(PROMPTS_DIR, `${name}.md`);
      console.log(`  프롬프트: ${chalk.cyan(promptFile)}`);
    }
    console.log('');
  } catch (err) {
    const error = err as Error;
    console.log(chalk.red(`\n  오류: ${error.message}\n`));
    process.exit(1);
  }
}
