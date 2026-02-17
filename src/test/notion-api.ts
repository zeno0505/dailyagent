import { loadConfig } from "../config";
import { getActiveWorkspace } from "../workspace";
import { fetchPendingTask } from "../notion-api";

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

  const task = await fetchPendingTask(apiToken, datasourceId, workspace.notion);
  console.log(task);
}

main();