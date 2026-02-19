import { fileURLToPath } from 'url';
import { DailyAgentConfig, Workspace } from '../types/config.js';
import { Logger } from "../logger.js";
import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import { WorkResult } from '../types/core.js';
import { runClaude, runCursor } from '../core/cli-runner.js';
import { updateNotionPage } from '../notion-api.js';
import { Job } from '../types/jobs.js';

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
  workDir: string,
  workResult: WorkResult,
  job: Job,
  config: DailyAgentConfig,
  workspace: Workspace,
  settingsFile: string | undefined,
  logger: Logger
}
export async function updateNotionOnError(
  { taskInfo, workDir, workResult, job, config, workspace, settingsFile, logger }: UpdateNotionOnErrorParams
): Promise<void> {
  try {
    // Notion API 사용 여부에 따라 분기
    if (workspace.notion.use_api && workspace.notion.api_token) {
      // Notion API 직접 호출
      await logger.info('Notion API를 사용하여 에러 상태 업데이트');

      if (!workspace.notion.api_token) {
        throw new Error('Notion API 토큰이 설정되지 않았습니다.');
      }

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
        workspace.notion.api_token,
        taskInfoTyped.task_id,
        properties,
        content
      );

      await logger.info('Notion 에러 업데이트 완료 (API)');
    } else {
      // MCP 사용 (기존 방식)
      const errorPrompt = `# Notion 에러 상태 업데이트

작업 정보:
\`\`\`json
${JSON.stringify(taskInfo, null, 2)}
\`\`\`

에러 내용:
\`\`\`
${(workResult.error || 'Unknown error').toString()}
\`\`\`

MCP 도구 \`notion-update-page\`를 사용하여 아래 작업을 수행하세요:

1. 페이지 ID: 위 JSON의 "task_id" 사용
2. 속성 업데이트:
   - "${workspace.notion.column_status || '상태'}": "${workspace.notion.column_status_error || '작업 실패'}"

3. 페이지 본문에 아래 내용을 추가하세요:
\`\`\`markdown

---

## 자동화 작업 실패

**실패 시간:** ${new Date().toISOString()}

**에러 내용:**
${(workResult.error || 'Unknown error').toString()}

\`\`\`

완료 후 결과를 JSON으로 반환하세요:
\`\`\`json
{ "success": true, "message": "Notion 에러 상태 업데이트 완료" }
\`\`\``;

      const runAgent = job.agent === 'claude-code' ? runClaude : runCursor;
      const result = await runAgent({
        prompt: errorPrompt,
        workDir,
        settingsFile: workspace.notion.use_api ? undefined : settingsFile,
        timeout: '5m',
        logger,
        model: job.model,
      });

      await logger.info(`Notion 에러 업데이트 완료: ${JSON.stringify(result)}`);
    }
  } catch (err) {
    const errMessage = err instanceof Error ? err.message : String(err);
    await logger.error(`Notion 에러 업데이트 실패: ${errMessage}`);
  }
}
