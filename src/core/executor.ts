import path from 'path';
import fs from 'fs-extra';
import { execSync } from 'child_process';
import { loadConfig } from '../config';
import { getJob, updateJob, acquireLock, releaseLock } from '../jobs';
import { Logger } from '../logger';
import { generateInitialPrompt, generateWorkPrompt, generateFinishPrompt } from './prompt-generator';
import { runClaude } from './claude-runner';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 작업 실행 오케스트레이터
 * 3단계 분리: Phase 1 (Notion 조회) → Phase 2 (코드 작업) → Phase 3 (Notion 업데이트)
 */
export async function executeJob(jobName: string): Promise<unknown> {
  const logger = new Logger(jobName);
  await logger.init();

  await logger.info('==========================================');
  await logger.info(`작업 실행 시작: ${jobName}`);
  await logger.info('==========================================');

  // 1. Load config and job
  const config = await loadConfig();
  if (!config) {
    throw new Error('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.');
  }

  const job = await getJob(jobName);
  if (!job) {
    throw new Error(`작업 "${jobName}"을(를) 찾을 수 없습니다.`);
  }

  if (job.status === 'paused') {
    await logger.info(`작업 "${jobName}"은(는) 일시 중지 상태입니다. 건너뜁니다.`);
    return { skipped: true, reason: 'paused' };
  }

  const workDir = job.working_dir.replace(/^~/, process.env.HOME || '~');

  // 2. Validate environment
  await validateEnvironment(workDir, logger);

  // 3. Acquire lock
  await acquireLock(jobName);
  await logger.info('PID 잠금 획득');

  // Resolve settings file
  const settingsFile = resolveSettingsFile();

  try {
    // ========================================
    // Phase 1: Notion 조회 (model: sonnet, timeout: 5m)
    // ========================================
    await logger.info('--- Phase 1: Notion 조회 시작 ---');
    const initPrompt = generateInitialPrompt({
      notionDbUrl: config.notion.database_url,
      columns: config.notion,
    });
    console.log(chalk.gray('--------------------------------'));
    console.log(chalk.gray('[Phase 1] 프롬프트:'));
    console.log(chalk.gray(initPrompt));
    console.log(chalk.gray('--------------------------------'));

    const initResult = await runClaude({
      prompt: initPrompt,
      workDir,
      settingsFile,
      timeout: '5m',
      logger,
      model: 'sonnet',
    });
    await logger.info(`Phase 1 완료: ${JSON.stringify(initResult)}`);

    // Phase 1 JSON 파싱 실패 체크
    if (initResult.raw_output) {
      throw new Error(`Phase 1 결과 파싱 실패: ${initResult.raw_output}`);
    }

    // 작업 대기 항목 없으면 조기 종료
    if ('no_tasks' in initResult && initResult.no_tasks) {
      await logger.info('작업 대기 항목 없음 — 조기 종료');
      await updateJob(jobName, {
        last_run: new Date().toISOString(),
        last_status: null,
      });
      return initResult;
    }

    const taskInfo = initResult;

    // ========================================
    // Phase 2: 코드 작업 + Git Push (model: 기본값, timeout: job.timeout)
    // ========================================
    await logger.info('--- Phase 2: 코드 작업 시작 ---');
    const workPrompt = generateWorkPrompt({
      workDir,
      taskInfo,
    });
    console.log(chalk.gray('--------------------------------'));
    console.log(chalk.gray('[Phase 2] 프롬프트:'));
    console.log(chalk.gray(workPrompt));
    console.log(chalk.gray('--------------------------------'));

    let workResult: { success?: boolean; error?: string; [key: string]: unknown };
    try {
      const phase2Result = await runClaude({
        prompt: workPrompt,
        workDir,
        settingsFile,
        timeout: String(job.timeout || '30m'),
        logger,
      });
      await logger.info(`Phase 2 완료: ${JSON.stringify(phase2Result)}`);

      // Phase 2 JSON 파싱 실패 체크
      if (phase2Result.raw_output) {
        workResult = { success: false, error: `Phase 2 결과 파싱 실패: ${phase2Result.raw_output}` };
      } else {
        workResult = phase2Result;
      }
    } catch (err) {
      const error = err as Error;
      await logger.error(`Phase 2 실패: ${error.message}`);
      workResult = { success: false, error: error.message };
    }

    // Phase 2 실패 시 Notion 직접 업데이트
    if (workResult.success === false || workResult.error) {
      await logger.info('--- Phase 2 실패로 인한 Notion 직접 업데이트 ---');
      await updateNotionOnError(taskInfo, workResult, config, settingsFile, logger);
    }

    // ========================================
    // Phase 3: Notion 업데이트 (model: sonnet, timeout: 5m)
    // ========================================
    await logger.info('--- Phase 3: Notion 업데이트 시작 ---');
    const finishPrompt = generateFinishPrompt({
      notionDbUrl: config.notion.database_url,
      taskInfo,
      workResult,
      columns: config.notion,
    });
    console.log(chalk.gray('--------------------------------'));
    console.log(chalk.gray('[Phase 3] 프롬프트:'));
    console.log(chalk.gray(finishPrompt));
    console.log(chalk.gray('--------------------------------'));

    const result = await runClaude({
      prompt: finishPrompt,
      workDir,
      settingsFile,
      timeout: '5m',
      logger,
      model: 'sonnet',
    });
    await logger.info(`Phase 3 완료: ${JSON.stringify(result)}`);

    // 7. Update job metadata
    await updateJob(jobName, {
      last_run: new Date().toISOString(),
      last_status: workResult.success === false ? 'error' : 'success',
    });

    await logger.info('작업 완료');
    await logger.info('==========================================');

    return result;
  } catch (err) {
    const error = err as Error;
    await logger.error(`작업 실패: ${error.message}`);

    await updateJob(jobName, {
      last_run: new Date().toISOString(),
      last_status: 'error',
    });

    throw err;
  } finally {
    // 8. Release lock
    await releaseLock(jobName);
    await logger.info('PID 잠금 해제');
  }
}

async function validateEnvironment(workDir: string, logger: Logger): Promise<void> {
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

function resolveSettingsFile(): string | undefined {
  // Check for template settings file in package
  const pkgSettings = path.join(__dirname, '..', '..', 'templates', 'claude-settings.json');
  if (fs.pathExistsSync(pkgSettings)) {
    return pkgSettings;
  }
  return undefined;
}

async function updateNotionOnError(
  taskInfo: unknown,
  workResult: { error?: string; [key: string]: unknown },
  config: { notion: { database_url: string; column_status?: string; column_status_error?: string } },
  settingsFile: string | undefined,
  logger: Logger
): Promise<void> {
  try {
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
   - "${config.notion.column_status || '상태'}": "${config.notion.column_status_error || '작업 실패'}"

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

    const result = await runClaude({
      prompt: errorPrompt,
      workDir: process.cwd(),
      settingsFile,
      timeout: '5m',
      logger,
      model: 'sonnet',
    });

    await logger.info(`Notion 에러 업데이트 완료: ${JSON.stringify(result)}`);
  } catch (err) {
    const error = err as Error;
    await logger.error(`Notion 에러 업데이트 실패: ${error.message}`);
    // 에러 업데이트 실패는 warning으로만 처리 (주요 작업은 이미 실패)
  }
}
