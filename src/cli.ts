import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };

export const program = new Command();

program
  .name('dailyagent')
  .description('AI-powered task automation CLI')
  .version(pkg.version);

program
  .command('init')
  .description('설정 초기화 위저드')
  .action(async () => {
    const { initCommand } = await import('./commands/init');
    await initCommand();
  });

program
  .command('register')
  .description('새 작업 등록')
  .action(async () => {
    const { registerCommand } = await import('./commands/register');
    await registerCommand();
  });

program
  .command('list')
  .description('등록된 작업 목록 조회')
  .action(async () => {
    const { listCommand } = await import('./commands/list');
    await listCommand();
  });

program
  .command('unregister <name>')
  .description('등록된 작업 삭제')
  .action(async (name: string) => {
    const { unregisterCommand } = await import('./commands/unregister');
    await unregisterCommand(name);
  });

program
  .command('run <name>')
  .description('지정된 작업 즉시 실행')
  .action(async (name: string) => {
    const { runCommand } = await import('./commands/run');
    await runCommand(name);
  });

program
  .command('pause <name>')
  .description('작업 일시 중지')
  .action(async (name: string) => {
    const { pauseCommand } = await import('./commands/pause');
    await pauseCommand(name);
  });

program
  .command('resume <name>')
  .description('일시 중지된 작업 재개')
  .action(async (name: string) => {
    const { resumeCommand } = await import('./commands/resume');
    await resumeCommand(name);
  });

program
  .command('status <name>')
  .description('작업 상태 및 실행 이력 조회')
  .option('-n, --count <number>', '표시할 실행 이력 수', parseInt)
  .action(async (name: string, options: { count?: number }) => {
    const { statusCommand } = await import('./commands/status');
    await statusCommand(name, options);
  });

program
  .command('logs <name>')
  .description('작업의 로그 파일 조회')
  .option('-f, --follow', '실시간 로그 모니터링 (최신 로그 표시)')
  .option('-n, --lines <number>', '표시할 로그 줄 수', parseInt)
  .action(async (name: string, options: { follow?: boolean; lines?: number }) => {
    const { logsCommand } = await import('./commands/logs');
    await logsCommand(name, options);
  });

program
  .command('schedule <action> [name]')
  .description('OS 스케줄러(crontab/launchd) 연동 관리 (on|off|status)')
  .action(async (action: string, name?: string) => {
    const { scheduleCommand } = await import('./commands/schedule');
    await scheduleCommand(action, name);
  });

const workspaceCommand = program
  .command('workspace')
  .description('Workspace 관리 (추가, 목록, 제거, 전환)');

workspaceCommand
  .command('add')
  .description('새 Workspace 추가')
  .action(async () => {
    const { workspaceAddCommand } = await import('./commands/workspace/add');
    await workspaceAddCommand();
  });

workspaceCommand
  .command('list')
  .description('등록된 Workspace 목록 조회')
  .action(async () => {
    const { workspaceListCommand } = await import('./commands/workspace/list');
    await workspaceListCommand();
  });

workspaceCommand
  .command('remove <name>')
  .description('Workspace 제거')
  .action(async (name: string) => {
    const { workspaceRemoveCommand } = await import('./commands/workspace/remove');
    await workspaceRemoveCommand(name);
  });

workspaceCommand
  .command('switch [name]')
  .description('활성화할 Workspace 선택')
  .action(async (name?: string) => {
    const { workspaceSwitchCommand } = await import('./commands/workspace/switch');
    await workspaceSwitchCommand(name);
  });
