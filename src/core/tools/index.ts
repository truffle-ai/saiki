/**
 * Custom Tools System for Saiki
 *
 * This module provides a clean system for creating custom tools that work alongside MCP servers.
 * Users can define tools in a `/tools` folder and configure them via YAML.
 */

// Core types and interfaces
export type {
    Tool,
    ToolExecutionContext,
    ToolExecutionResult,
    ToolManagerToolSet,
    ToolDiscoveryResult,
    ToolDiscoveryMetadata,
    ToolExecutionSettings,
} from './types.js';

export { ToolExecutionError, ToolRegistrationError } from './types.js';

// Tool creation and management
export { createTool, validateToolResult, validateToolDefinition } from './tool-factory.js';

export type { CreateToolOptions } from './tool-factory.js';

// Tool registry
export { ToolRegistry, globalToolRegistry } from './tool-registry.js';

// Tool execution
export { ToolExecutor } from './tool-executor.js';

// Tool discovery
export { ToolDiscovery } from './tool-discovery.js';

// Schema conversion
export { SchemaConverter } from './schema-converter.js';
export type { JSONSchema } from './schema-converter.js';

// Custom tools provider (orchestrates all custom tool services)
export { CustomToolsProvider } from './custom-tools-provider.js';

// Unified tool manager (main interface for LLM)
export { ToolManager } from './tool-manager.js';
