import fs from 'fs-extra';
import { confirm, input, number, password } from "@inquirer/prompts";
import { NotionConfig } from "../types/config.js";
import { DEFAULT_WORKSPACE_NOTION_CONFIG } from "../config.js";
import path from 'path';

export async function promptWorkDirecotry() {
  const working_dir = await input({
    message: '작업 디렉토리 (절대경로 또는 ~/ 사용):',
    validate: (val) => {
      if (!val) return '작업 디렉토리를 입력해주세요.';
      const resolved = val.replace(/^~/, process.env.HOME || '~');
      if (!fs.pathExistsSync(resolved)) return `디렉토리가 존재하지 않습니다: ${resolved}`;
      if (!fs.pathExistsSync(path.join(resolved, '.git'))) return `Git 저장소가 아닙니다: ${resolved}`;
      return true;
    },
  });
  return working_dir;
}

export async function promptWorkspaceNotionConfig(): Promise<NotionConfig> {
  const api_token = await password({
    message: 'Notion API 토큰 (Internal Integration Token):',
    validate: (val) => (val.length > 0 ? true : 'API 토큰을 입력해주세요.'),
  });
  const datasource_id = await input({
    message: 'Notion 데이터소스 ID:',
    validate: (val) => (val.length > 0 ? true : '데이터소스 ID를 입력해주세요.'),
  });
   
  const use_notion_template = await confirm({
    message: 'Notion 템플릿을 그대로 사용하시겠습니까? (미사용 시 컬럼명을 직접 입력합니다.)',
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
  let column_review_count: string = DEFAULT_WORKSPACE_NOTION_CONFIG.column_review_count;

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
    column_review_count = await input({
      message: '검토 횟수 컬럼명:',
      default: DEFAULT_WORKSPACE_NOTION_CONFIG.column_review_count,
    });
  }

  const max_review_count = await number({
    message: '자동 재검토 최대 횟수 (작업 대기 항목이 없을 때 검토 전 항목을 재검토하는 최대 횟수):',
    default: DEFAULT_WORKSPACE_NOTION_CONFIG.max_review_count,
    validate: (val) => {
      if (val === undefined || val === null) return '숫자를 입력해주세요.';
      if (val < 0) return '0 이상의 숫자를 입력해주세요.';
      return true;
    },
  });

  return {
    api_token,
    datasource_id,
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
    column_review_count,
    max_review_count: max_review_count ?? DEFAULT_WORKSPACE_NOTION_CONFIG.max_review_count,
  };
}