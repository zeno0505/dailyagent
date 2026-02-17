import { input, confirm, password } from '@inquirer/prompts';
import chalk from 'chalk';
import { isInitialized, DEFAULT_WORKSPACE_NOTION_CONFIG } from '../../config';
import { addWorkspace } from '../../workspace';
import type { Workspace } from '../../types/config';

export async function workspaceAddCommand(): Promise<void> {
  if (!isInitialized()) {
    console.log(chalk.red('설정이 초기화되지 않았습니다. "dailyagent init"을 먼저 실행하세요.'));
    process.exit(1);
  }

  console.log(chalk.bold('\n  새 Workspace 추가\n'));

  const name = await input({
    message: 'Workspace 이름 (영문, 하이픈 허용):',
    validate: (val) => {
      if (!val) return 'Workspace 이름을 입력해주세요.';
      if (!/^[a-z0-9-]+$/.test(val)) return '영문 소문자, 숫자, 하이픈만 사용 가능합니다.';
      return true;
    },
  });

  const use_api = await confirm({
    message: '(권장) Notion API를 직접 사용하시겠습니까?',
    default: true,
  });

  let database_url: string | undefined;
  let api_token: string | undefined;
  let datasource_id: string | undefined;

  if (!use_api) {
    database_url = await input({
      message: 'Notion 데이터베이스 URL:',
      validate: (val) => (val.includes('notion.so') ? true : 'Notion URL을 입력해주세요.'),
    });
  } else {
    api_token = await password({
      message: 'Notion API 토큰 (Internal Integration Token):',
      validate: (val) => (val.length > 0 ? true : 'API 토큰을 입력해주세요.'),
    });
    datasource_id = await input({
      message: 'Notion 데이터소스 ID (API 사용 시 필요):',
      validate: (val) => (val.length > 0 ? true : '데이터소스 ID를 입력해주세요.'),
    });
  }

  const use_notion_template = await confirm({
    message: 'Notion 템플릿을 그대로 사용하시겠습니까?',
    default: true,
  });

  let column_priority: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_priority;
  let column_status: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_status;
  let column_status_wait: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_wait;
  let column_status_review: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_review;
  let column_status_error: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_error;
  let column_status_complete: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_complete;
  let column_base_branch: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_base_branch;
  let column_work_branch: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_work_branch;
  let column_prerequisite: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_prerequisite;
  let column_created_time: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_created_time;

  if (!use_notion_template) {
    column_priority = await input({
      message: '우선순위 컬럼명:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_priority,
    });
    column_status = await input({
      message: '상태 컬럼명:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_status,
    });
    column_status_wait = await input({
      message: '자동화 준비 완료 상태 값:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_wait,
    });
    column_status_review = await input({
      message: '자동화 완료 상태 값:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_review,
    });
    column_status_error = await input({
      message: '자동화 오류 상태값:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_error,
    });
    column_status_complete = await input({
      message: '작업 완료 상태 값:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_status_complete,
    });
    column_base_branch = await input({
      message: '기준 브랜치 컬럼명:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_base_branch,
    });
    column_work_branch = await input({
      message: '작업 브랜치 컬럼명:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_work_branch,
    });
    column_prerequisite = await input({
      message: '선행 작업 컬럼명:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_prerequisite,
    });
    column_created_time = await input({
      message: '작업 일자 컬럼명:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_created_time,
    });
  }

  const workspace: Workspace = {
    name,
    notion: {
      ...(database_url != null && { database_url }),
      use_api,
      ...(api_token != null && { api_token }),
      ...(datasource_id != null && { datasource_id }),
      column_priority,
      column_status,
      column_status_wait,
      column_status_review,
      column_status_complete,
      column_status_error,
      column_base_branch,
      column_work_branch,
      column_prerequisite,
      column_created_time,
    },
  };

  try {
    await addWorkspace(workspace);

    console.log('');
    console.log(chalk.green(`  Workspace "${name}"이(가) 추가되었습니다!`));
    console.log(`  ${chalk.cyan(`dailyagent workspace switch ${name}`)} 명령으로 활성화하세요.`);
    console.log('');
  } catch (err) {
    const error = err as Error;
    console.log(chalk.red(`\n  오류: ${error.message}\n`));
    process.exit(1);
  }
}
