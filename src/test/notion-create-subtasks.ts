import { loadConfig } from "../config";
import { createNotionSubtasks } from "../notion-api";
import { getActiveWorkspace } from "../workspace";

async function main() {
  const config = await loadConfig();
  if (!config) {
    throw new Error('Config not found');
  }
  const workspace = await getActiveWorkspace();
  if (!workspace) {
    throw new Error('Active workspace not found');
  }

  const apiToken = workspace.notion.api_token;
  const datasourceId = workspace.notion.datasource_id;
  if (!apiToken || !datasourceId) {
    throw new Error('API token or datasource ID not found');
  }

  const subtasks = await createNotionSubtasks(apiToken, datasourceId, [
    {
      title: 'Test Task',
      requirements: 'This is a test task',
      base_branch: 'main',
    },
  ], workspace.notion);
  console.log(subtasks);
}

main();