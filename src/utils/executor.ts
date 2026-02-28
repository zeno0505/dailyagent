import { fileURLToPath } from 'url';
import { Logger } from "../logger.js";
import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function validateEnvironment(workDir: string, logger: Logger): Promise<void> {
  // Check working directory
  if (!(await fs.pathExists(workDir))) {
    throw new Error(`작업 디렉토리가 존재하지 않습니다: ${workDir}`);
  }
  await logger.info(`작업 디렉토리: ${workDir}`);

  // Check git repo
  if (!(await fs.pathExists(path.join(workDir, '.git')))) {
    throw new Error(`Git 저장소가 아닙니다: ${workDir}`);
  }

  // Check claude CLI
  try {
    const version = execSync('claude --version', { encoding: 'utf8' }).trim();
    await logger.info(`Claude Code CLI 버전: ${version}`);
  } catch {
    throw new Error('claude 명령어를 찾을 수 없습니다. Claude Code를 설치해주세요.');
  }

  // Check gh CLI (non-blocking)
  try {
    const ghVersion = execSync('gh --version', { encoding: 'utf8' }).trim().split('\n')[0];
    await logger.info(`GitHub CLI 버전: ${ghVersion}`);
    // Check gh auth status
    try {
      execSync('gh auth status', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      await logger.info('GitHub CLI 인증 상태: 정상');
    } catch {
      await logger.warn('GitHub CLI 인증이 필요합니다. PR 생성이 실패할 수 있습니다. "gh auth login"을 실행하세요.');
    }
  } catch {
    await logger.warn('gh CLI가 설치되어 있지 않습니다. PR 자동 생성은 건너뜁니다.');
  }
}

export function resolveSettingsFile(): string | undefined {
  // Check for template settings file in package
  const pkgSettings = path.join(__dirname, '..', '..', 'templates', 'claude-settings.json');
  if (fs.pathExistsSync(pkgSettings)) {
    return pkgSettings;
  }
  return undefined;
}

