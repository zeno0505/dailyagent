import { fileURLToPath } from 'url';
import { Workspace } from '../types/config.js';
import { Logger } from "../logger.js";
import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import { WorkResult } from '../types/core.js';
import { updateNotionPage } from '../notion-api.js';

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

interface UpdateNotionOnErrorParams {
  taskInfo: unknown,
  workResult: WorkResult,
  workspace: Workspace,
  logger: Logger
}
export async function updateNotionOnError(
  { taskInfo, workResult, workspace, logger }: UpdateNotionOnErrorParams
): Promise<void> {
  try {
    const apiToken = workspace.notion.api_token;
    if (!apiToken) {
      throw new Error('Notion API 토큰이 설정되지 않았습니다.');
    }

    await logger.info('Notion API를 사용하여 에러 상태 업데이트');

    const statusColumn = workspace.notion.column_status || '상태';
    const statusError = workspace.notion.column_status_error || '작업 실패';
    const taskInfoTyped = taskInfo as { task_id: string };

    const properties: Record<string, unknown> = {
      [statusColumn]: {
        status: {
          name: statusError,
        },
      },
    };

    const content = `\n---\n\n## 자동화 작업 실패\n\n실패 시간: ${new Date().toISOString()}\n\n에러 내용:\n${(workResult.error || 'Unknown error').toString()}\n`;

    await updateNotionPage(
      apiToken,
      taskInfoTyped.task_id,
      properties,
      content
    );

    await logger.info('Notion 에러 업데이트 완료');
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    await logger.error(`Notion 에러 업데이트 실패: ${errMessage}`);
  }
}
