'use strict';

const fs = require('fs-extra');
const path = require('path');
const { JOBS_FILE, LOCKS_DIR } = require('./config');

const DEFAULT_JOBS_DATA = { jobs: [] };

async function loadJobs() {
  if (!(await fs.pathExists(JOBS_FILE))) {
    return { ...DEFAULT_JOBS_DATA };
  }
  return fs.readJson(JOBS_FILE);
}

async function saveJobs(data) {
  await fs.writeJson(JOBS_FILE, data, { spaces: 2 });
}

async function addJob(job) {
  const data = await loadJobs();
  const existing = data.jobs.find((j) => j.name === job.name);
  if (existing) {
    throw new Error(`작업 "${job.name}"이(가) 이미 존재합니다.`);
  }
  data.jobs.push({
    ...job,
    status: 'active',
    created_at: new Date().toISOString(),
    last_run: null,
    last_status: null,
  });
  await saveJobs(data);
}

async function getJob(name) {
  const data = await loadJobs();
  return data.jobs.find((j) => j.name === name) || null;
}

async function listJobs() {
  const data = await loadJobs();
  return data.jobs;
}

async function updateJob(name, updates) {
  const data = await loadJobs();
  const idx = data.jobs.findIndex((j) => j.name === name);
  if (idx === -1) {
    throw new Error(`작업 "${name}"을(를) 찾을 수 없습니다.`);
  }
  data.jobs[idx] = { ...data.jobs[idx], ...updates };
  await saveJobs(data);
  return data.jobs[idx];
}

async function removeJob(name) {
  const data = await loadJobs();
  const idx = data.jobs.findIndex((j) => j.name === name);
  if (idx === -1) {
    throw new Error(`작업 "${name}"을(를) 찾을 수 없습니다.`);
  }
  data.jobs.splice(idx, 1);
  await saveJobs(data);
}

// PID-based locking

function lockPath(jobName) {
  return path.join(LOCKS_DIR, `${jobName}.lock`);
}

async function acquireLock(jobName) {
  await fs.ensureDir(LOCKS_DIR);
  const lockFile = lockPath(jobName);

  if (await fs.pathExists(lockFile)) {
    const content = await fs.readFile(lockFile, 'utf8');
    const pid = parseInt(content.trim(), 10);

    // Check if process is still running
    try {
      process.kill(pid, 0);
      throw new Error(`작업 "${jobName}"이(가) 이미 실행 중입니다 (PID: ${pid}).`);
    } catch (err) {
      if (err.code === 'ESRCH') {
        // Process not running, stale lock
        await fs.remove(lockFile);
      } else if (err.message.includes('이미 실행 중')) {
        throw err;
      }
    }
  }

  await fs.writeFile(lockFile, String(process.pid));
}

async function releaseLock(jobName) {
  const lockFile = lockPath(jobName);
  await fs.remove(lockFile);
}

module.exports = {
  loadJobs,
  saveJobs,
  addJob,
  getJob,
  listJobs,
  updateJob,
  removeJob,
  acquireLock,
  releaseLock,
};
