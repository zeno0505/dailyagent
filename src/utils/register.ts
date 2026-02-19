import { execSync } from "child_process";
import { Agent } from "./cli-runner.js";
import chalk from "chalk";

export async function validateAgentModel (agent: Agent, val: string): Promise<string | true> {
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
}