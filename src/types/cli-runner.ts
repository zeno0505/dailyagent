/** Claude Code CLI --output-format json envelope */
export interface ClaudeCliEnvelope {
  type: 'result';
  subtype: 'success' | 'error' | 'cancelled';
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  num_turns: number;
  result: string;
  stop_reason: string | null;
  session_id: string;
  total_cost_usd: number;
  usage: {
    input_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
    server_tool_use: {
      web_search_requests: number;
      web_fetch_requests: number;
    };
    service_tier: string;
    cache_creation: {
      ephemeral_1h_input_tokens: number;
      ephemeral_5m_input_tokens: number;
    };
    inference_geo: string;
    iterations: any[];
    speed: string;
  };
  modelUsage: {
    [modelName: string]: {
      inputTokens: number;
      outputTokens: number;
      cacheReadInputTokens: number;
      cacheCreationInputTokens: number;
      webSearchRequests: number;
      costUSD: number;
      contextWindow: number;
      maxOutputTokens: number;
    };
  };
  permission_denials: any[];
  uuid: string;
}

/** Cursor Agent CLI --output-format json envelope */
export interface CursorCliEnvelope {
  type: 'result';
  subtype: 'success' | 'error' | 'cancelled';
  is_error: boolean;
  duration_ms: number;
  duration_api_ms: number;
  result: string;
  stop_reason: string | null;
  session_id: string;
  request_id: string;
}