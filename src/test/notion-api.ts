import { loadConfig } from "../config.js";
import { getActiveWorkspace } from "../workspace.js";
import { fetchPendingTask } from "../notion-api.js";

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
  const databaseId = workspace.notion.database_id;
  if (!apiToken || !databaseId) {
    throw new Error('API token or database ID not found');
  }

  const task = await fetchPendingTask(apiToken, databaseId, workspace.notion);
  console.log(task);
}

main();