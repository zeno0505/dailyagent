import { loadConfig, saveConfig } from './config.js';
import { loadJobs } from './jobs.js';
import type { Workspace, NotionConfig } from './types/config.js';

export async function listWorkspaces(): Promise<Workspace[]> {
  const config = await loadConfig();
  return config?.workspaces || [];
}

export async function getActiveWorkspace(): Promise<Workspace | null> {
  const config = await loadConfig();
  if (!config || !config.workspaces) {
    return null;
  }

  const activeWorkspaceName = config.active_workspace || 'default';
  return config.workspaces.find(w => w.name === activeWorkspaceName) || null;
}

export async function getWorkspace(name: string): Promise<Workspace | null> {
  const config = await loadConfig();
  if (!config || !config.workspaces) {
    return null;
  }

  return config.workspaces.find(w => w.name === name) || null;
}

export async function addWorkspace(workspace: Workspace): Promise<void> {
  let config = await loadConfig();

  if (!config) {
    throw new Error('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.');  
  }

  if (!config.workspaces) {
    config.workspaces = [];
  }

  // Check if workspace already exists
  if (config.workspaces.some(w => w.name === workspace.name)) {
    throw new Error(`Workspace "${workspace.name}"이(가) 이미 존재합니다.`);
  }

  config.workspaces.push(workspace);

  // Set as active if it's the first workspace
  if (config.workspaces.length === 1) {
    config.active_workspace = workspace.name;
  }

  await saveConfig(config);
}

export async function renameWorkspace(oldName: string, newName: string): Promise<void> {
  const config = await loadConfig();
  const jobConfig = await loadJobs();
  if (!config || !config.workspaces) {
    throw new Error('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.');
  }

  const workspace = config.workspaces.find(w => w.name === oldName);
  if (!workspace) {
    throw new Error(`Workspace "${oldName}"을(를) 찾을 수 없습니다.`);
  }

  if (config.active_workspace === oldName) {
    config.active_workspace = newName;
  }

  jobConfig.jobs.forEach(job => {
    if (job.workspace === oldName) {
      job.workspace = newName;
    }
  });

  workspace.name = newName;
  await saveConfig(config);
}

export async function switchWorkspace(name: string): Promise<void> {
  const config = await loadConfig();

  if (!config || !config.workspaces) {
    throw new Error('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.');
  }

  const workspace = config.workspaces.find(w => w.name === name);
  if (!workspace) {
    throw new Error(`Workspace "${name}"을(를) 찾을 수 없습니다.`);
  }

  config.active_workspace = name;
  await saveConfig(config);
}

export async function removeWorkspace(name: string): Promise<void> {
  const config = await loadConfig();

  if (!config || !config.workspaces) {
    throw new Error('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.');
  }

  const idx = config.workspaces.findIndex(w => w.name === name);
  if (idx === -1) {
    throw new Error(`Workspace "${name}"을(를) 찾을 수 없습니다.`);
  }

  config.workspaces.splice(idx, 1);

  // If removed workspace was active, switch to first remaining workspace
  if (config.active_workspace === name) {
    config.active_workspace = config.workspaces.length > 0 ? config.workspaces[0]!.name : 'default';
  }

  await saveConfig(config);
}

export async function updateWorkspaceNotionConfig(name: string, notionConfig: NotionConfig): Promise<void> {
  const config = await loadConfig();

  if (!config || !config.workspaces) {
    throw new Error('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.');
  }

  const workspace = config.workspaces.find(w => w.name === name);
  if (!workspace) {
    throw new Error(`Workspace "${name}"을(를) 찾을 수 없습니다.`);
  }

  workspace.notion = notionConfig;
  await saveConfig(config);
}
