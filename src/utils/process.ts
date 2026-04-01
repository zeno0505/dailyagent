import { spawnSync } from 'child_process';

export const DEFAULT_ENV_PATH = '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin';

/**
 * WSL2의 Windows 경로(/mnt/...)를 제거한 Linux 전용 PATH를 반환합니다.
 */
export function resolveLinuxPath(): string {
  return (process.env.PATH || '')
    .split(':')
    .filter((part) => part && !part.startsWith('/mnt/'))
    .join(':') || DEFAULT_ENV_PATH;
}

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
 * dailyagent 실행 명령을 찾습니다.
 */
export function resolveDailyagentCommand(): string {
  const direct = findCommand('dailyagent');
  if (direct) return direct;

  const npxPath = findCommand('npx');
  if (npxPath) return `${npxPath} dailyagent`;

  return 'dailyagent';
}
