import { loadConfig } from "../config";
import { fetchPendingTask } from "../notion-api";

async function main() {
  const config = await loadConfig();

  if (!config) {
    throw new Error('Config not found');
  }
  const apiToken = config.notion.api_token;
  const datasourceId = config.notion.datasource_id;
  if (!apiToken || !datasourceId) {
    throw new Error('API token or datasource ID not found');
  }

  const task = await fetchPendingTask(apiToken, datasourceId, config.notion);
  console.log(task);
}

main();