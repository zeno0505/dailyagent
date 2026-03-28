import { spawnSync } from 'child_process';

/**
 * which 명령어로 실행 파일 경로를 찾습니다.
 */
export function findCommand(command: string): string | null {
  const result = spawnSync('which', [command], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  const output = result.stdout.trim();
  return output.length > 0 ? output : null;
}

/**
 * 명령어 사용 가능 여부를 확인합니다.
 */
export function isCommandAvailable(command: string): boolean {
  const result = spawnSync('which', [command], {
    stdio: ['ignore', 'ignore', 'ignore']
  });

  return !result.error && result.status === 0;
}

/**
 * Native Windows 환경 여부를 확인합니다.
 * WSL(Windows Subsystem for Linux)에서는 false를 반환합니다.
 */
export function isWindowsNative(): boolean {
  if (process.platform !== 'win32') return false;
  // WSL 환경에서는 WSLENV 또는 WSL_DISTRO_NAME 환경변수가 설정됨
  return !process.env.WSLENV && !process.env.WSL_DISTRO_NAME;
}

/**
 * dailyagent 실행 명령을 찾습니다.
 */
export function resolveDailyagentCommand(): string {
  const direct = findCommand('dailyagent');
  if (direct) return direct;

  const npxPath = findCommand('npx');
  if (npxPath) return `${npxPath} dailyagent`;

  return 'dailyagent';
}
