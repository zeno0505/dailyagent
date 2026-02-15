'use strict';

const path = require('path');
const fs = require('fs-extra');
const { execSync } = require('child_process');
const { loadConfig } = require('../config');
const { getJob, updateJob, acquireLock, releaseLock } = require('../jobs');
const { Logger } = require('../logger');
const { generatePrompt } = require('./prompt-generator');
const { runClaude } = require('./claude-runner');
const chalk = require('chalk');

/**
 * 작업 실행 오케스트레이터
 * bash 스크립트의 전체 플로우를 Node.js로 포팅
 */
async function executeJob(jobName) {
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

  const workDir = job.working_dir.replace(/^~/, process.env.HOME);

  // 2. Validate environment
  await validateEnvironment(workDir, logger);

  // 3. Acquire lock
  await acquireLock(jobName);
  await logger.info('PID 잠금 획득');

  try {
    // 4. Generate prompt
    const prompt = generatePrompt({
      notionDbUrl: config.notion.database_url,
      workDir,
      columns: config.notion,
    });
    await logger.info('프롬프트 생성 완료');
    console.log(chalk.gray('--------------------------------'));
    console.log(chalk.gray('프롬프트:'));
    console.log(chalk.gray(prompt));
    console.log(chalk.gray('--------------------------------'));

    // 5. Resolve settings file
    const settingsFile = resolveSettingsFile();

    // 6. Run Claude
    await logger.info('Claude Code 실행 중...');
    const result = await runClaude({
      prompt,
      workDir,
      settingsFile,
      timeout: job.timeout || '30m',
      logger,
    });

    // 7. Update job metadata
    await updateJob(jobName, {
      last_run: new Date().toISOString(),
      last_status: 'success',
    });

    await logger.info('작업 완료');
    await logger.info('==========================================');

    return result;
  } catch (err) {
    await logger.error(`작업 실패: ${err.message}`);

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

async function validateEnvironment(workDir, logger) {
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
}

function resolveSettingsFile() {
  // Check for template settings file in package
  const pkgSettings = path.join(__dirname, '..', '..', 'templates', 'claude-settings.json');
  if (fs.pathExistsSync(pkgSettings)) {
    return pkgSettings;
  }
  return null;
}

module.exports = { executeJob };
