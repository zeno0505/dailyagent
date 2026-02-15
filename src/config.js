'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs-extra');

const CONFIG_DIR = path.join(os.homedir(), '.dailyagent');
const CONFIG_FILE = path.join(CONFIG_DIR, 'dailyagent.config.json');
const JOBS_FILE = path.join(CONFIG_DIR, 'jobs.json');
const LOGS_DIR = path.join(CONFIG_DIR, 'logs');
const LOCKS_DIR = path.join(CONFIG_DIR, 'locks');

const DEFAULT_CONFIG = {
  version: '1.0.0',
  notion: {
    database_url: '',
    column_priority: '우선순위',
    column_status: '상태',
    column_status_wait: '작업 대기',
    column_status_complete: '검토 전',
    column_base_branch: '기준 브랜치',
    column_work_branch: '작업 브랜치',
  },
  defaults: {
    agent: 'claude-code',
    timeout: '30m',
    base_branch: 'main',
  },
};

async function ensureConfigDir() {
  await fs.ensureDir(CONFIG_DIR);
  await fs.ensureDir(LOGS_DIR);
  await fs.ensureDir(LOCKS_DIR);
}

async function loadConfig() {
  if (!(await fs.pathExists(CONFIG_FILE))) {
    return null;
  }
  return fs.readJson(CONFIG_FILE);
}

async function saveConfig(config) {
  await ensureConfigDir();
  await fs.writeJson(CONFIG_FILE, config, { spaces: 2 });
}

function isInitialized() {
  return fs.pathExistsSync(CONFIG_FILE);
}

module.exports = {
  CONFIG_DIR,
  CONFIG_FILE,
  JOBS_FILE,
  LOGS_DIR,
  LOCKS_DIR,
  DEFAULT_CONFIG,
  ensureConfigDir,
  loadConfig,
  saveConfig,
  isInitialized,
};
