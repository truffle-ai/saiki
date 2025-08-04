// LLM and MCP schemas moved, other schemas will also be moved to schemas folder

import { type ValidatedLLMConfig } from '@core/llm/schemas.js';
import {
    type McpServerConfig,
    type ValidatedMcpServerConfig,
    type ServerConfigs,
} from '@core/mcp/schemas.js';

// Re-export types from other schemas for convenience
export type { ValidatedLLMConfig, McpServerConfig, ValidatedMcpServerConfig, ServerConfigs };
