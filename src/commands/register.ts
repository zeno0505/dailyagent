import { input, select } from '@inquirer/prompts';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import { isInitialized, PROMPTS_DIR } from '../config';
import { addJob } from '../jobs';
import type { PromptMode } from '../types/jobs';
import { Agent } from '../utils/cli-runner';

export async function registerCommand(): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  console.log(chalk.bold('\n  새 작업 등록\n'));

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
    validate: async (val) => {
      if (!val) return true;

      if (agent === 'cursor') {
        try {
          const output = execSync('agent models', { 
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'ignore']
          });

          const models = output
            .split('\n')
            .filter(line => line.trim())
            .map(line => line.trim().split(/\s+/)[0])
            .filter(Boolean);

          if (!models.includes(val)) {
            return `사용할 수 없는 모델입니다. agent models 명령어로 사용 가능한 모델을 확인하세요.`;
          }
        } catch (error) {
          console.log(chalk.yellow('\n  경고: agent models 명령어 실행 실패. 모델 검증을 건너뜁니다.'));
        }
      } else if (agent === 'claude-code') {
        if (!['sonnet', 'haiku', 'opus'].includes(val)) {
          return `사용할 수 없는 모델입니다. sonnet, haiku, opus 중 하나를 선택하세요.`;
        }
      }

      return true;
    },
  });

  const working_dir = await input({
    message: '작업 디렉토리 (절대경로 또는 ~/ 사용):',
    validate: (val) => {
      if (!val) return '작업 디렉토리를 입력해주세요.';
      const resolved = val.replace(/^~/, process.env.HOME || '~');
      if (!fs.pathExistsSync(resolved)) return `디렉토리가 존재하지 않습니다: ${resolved}`;
      if (!fs.pathExistsSync(path.join(resolved, '.git'))) return `Git 저장소가 아닙니다: ${resolved}`;
      return true;
    },
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

  try {
    const promptMode = prompt_mode as PromptMode;

    // 커스텀 프롬프트 파일 생성
    if (promptMode === 'custom') {
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
      ...(model && { model }),
      prompt_mode,
      working_dir,
      schedule,
      timeout,
    });

    console.log('');
    console.log(chalk.green(`  작업 "${name}"이(가) 등록되었습니다!`));
    console.log('');
    console.log(`  실행: ${chalk.cyan(`dailyagent run ${name}`)}`);
    if (promptMode === 'custom') {
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
