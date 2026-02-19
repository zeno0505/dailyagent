import fs from 'fs-extra';
import path from 'path';
import { JOBS_FILE, LOCKS_DIR } from './config.js';
import type { Job, JobsData, JobStatus } from './types/jobs.js';

const DEFAULT_JOBS_DATA: JobsData = { jobs: [] };

export async function loadJobs(): Promise<JobsData> {
  if (!(await fs.pathExists(JOBS_FILE))) {
    return { ...DEFAULT_JOBS_DATA };
  }
  return fs.readJson(JOBS_FILE) as Promise<JobsData>;
}

export async function saveJobs(data: JobsData): Promise<void> {
  await fs.writeJson(JOBS_FILE, data, { spaces: 2 });
}

export async function addJob(job: Omit<Job, 'status' | 'created_at' | 'last_run' | 'last_status'>): Promise<void> {
  const data = await loadJobs();
  const existing = data.jobs.find((j) => j.name === job.name);
  if (existing) {
    throw new Error(`작업 "${job.name}"이(가) 이미 존재합니다.`);
  }
  data.jobs.push({
    ...job,
    status: 'active' as JobStatus,
    created_at: new Date().toISOString(),
    last_run: null,
    last_status: null,
  });
  await saveJobs(data);
}

export async function getJob(name: string): Promise<Job | null> {
  const data = await loadJobs();
  return data.jobs.find((j) => j.name === name) ?? null;
}

export async function listJobs(): Promise<Job[]> {
  const data = await loadJobs();
  return data.jobs;
}

export async function updateJob(name: string, updates: Partial<Job>): Promise<Job> {
  const data = await loadJobs();
  const idx = data.jobs.findIndex((j) => j.name === name);
  if (idx === -1) {
    throw new Error(`작업 "${name}"을(를) 찾을 수 없습니다.`);
  }
  data.jobs[idx] = { ...data.jobs[idx]!, ...updates };
  await saveJobs(data);
  return data.jobs[idx]!;
}

export async function removeJob(name: string): Promise<void> {
  const data = await loadJobs();
  const idx = data.jobs.findIndex((j) => j.name === name);
  if (idx === -1) {
    throw new Error(`작업 "${name}"을(를) 찾을 수 없습니다.`);
  }
  data.jobs.splice(idx, 1);
  await saveJobs(data);
}

// PID-based locking

function lockPath(jobName: string): string {
  return path.join(LOCKS_DIR, `${jobName}.lock`);
}

export async function acquireLock(jobName: string): Promise<void> {
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
      if ((err as NodeJS.ErrnoException).code === 'ESRCH') {
        // Process not running, stale lock
        await fs.remove(lockFile);
      } else if ((err as Error).message.includes('이미 실행 중')) {
        throw err;
      }
    }
  }

  await fs.writeFile(lockFile, String(process.pid));
}

export async function releaseLock(jobName: string): Promise<void> {
  const lockFile = lockPath(jobName);
  await fs.remove(lockFile);
}
