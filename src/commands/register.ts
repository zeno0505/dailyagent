import inquirer from 'inquirer';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs-extra';
import { isInitialized } from '../config';
import { addJob } from '../jobs';
import type { Agent } from '../types/jobs';

export async function registerCommand(): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  console.log(chalk.bold('\n  새 작업 등록\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: '작업 이름 (영문, 하이픈 허용):',
      validate: (val: string) => {
        if (!val) return '작업 이름을 입력해주세요.';
        if (!/^[a-z0-9-]+$/.test(val)) return '영문 소문자, 숫자, 하이픈만 사용 가능합니다.';
        return true;
      },
    },
    {
      type: 'list',
      name: 'agent',
      message: 'AI 에이전트:',
      choices: [
        { name: 'Claude Code CLI', value: 'claude-code' },
        { name: 'Cursor CLI', value: 'cursor' },
      ],
      default: 'claude-code',
    },
    {
      type: 'input',
      name: 'model',
      message: '모델 (선택사항, 비용 최적화용 - 비워두면 기본값 사용):',
      default: '',
    },
    {
      type: 'input',
      name: 'working_dir',
      message: '작업 디렉토리 (절대경로 또는 ~/ 사용):',
      validate: (val: string) => {
        if (!val) return '작업 디렉토리를 입력해주세요.';
        const resolved = val.replace(/^~/, process.env.HOME || '~');
        if (!fs.pathExistsSync(resolved)) return `디렉토리가 존재하지 않습니다: ${resolved}`;
        if (!fs.pathExistsSync(path.join(resolved, '.git'))) return `Git 저장소가 아닙니다: ${resolved}`;
        return true;
      },
    },
    {
      type: 'input',
      name: 'schedule',
      message: 'Cron 스케줄 (후속 작업용, 예: 0 */5 * * *):',
      default: '0 */5 * * *',
    },
    {
      type: 'input',
      name: 'timeout',
      message: '타임아웃 (예: 30m, 1h):',
      default: '30m',
    },
  ]);

  try {
    await addJob({
      name: answers.name as string,
      agent: answers.agent as Agent,
      model: answers.model ? answers.model : undefined,
      working_dir: answers.working_dir as string,
      schedule: answers.schedule as string,
      timeout: answers.timeout as string,
    });

    console.log('');
    console.log(chalk.green(`  작업 "${answers.name}"이(가) 등록되었습니다!`));
    console.log('');
    console.log(`  실행: ${chalk.cyan(`dailyagent run ${answers.name}`)}`);
    console.log('');
  } catch (err) {
    const error = err as Error;
    console.log(chalk.red(`\n  오류: ${error.message}\n`));
    process.exit(1);
  }
}
