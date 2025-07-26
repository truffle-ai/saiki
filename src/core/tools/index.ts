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
    ToolSet,
    ToolDiscoveryResult,
    ToolDiscoveryMetadata,
    ToolExecutionSettings,
    // Legacy types for backward compatibility
    CustomTool,
    ToolFunction,
    ToolParameter,
    ToolMetadata,
} from './types.js';

export { ToolExecutionError, ToolRegistrationError } from './types.js';

// Tool creation and management
export { tool, createTool, validateToolResult, validateToolDefinition } from './tool-factory.js';

export type { CreateToolOptions, ToolOptions, ParameterOptions } from './tool-factory.js';

// Tool registry
export { ToolRegistry, globalToolRegistry } from './tool-registry.js';

// Tool execution
export { ToolExecutor } from './tool-executor.js';

// Tool discovery
export { ToolDiscovery } from './tool-discovery.js';

// Schema conversion
export { SchemaConverter } from './schema-converter.js';
export type { JSONSchema } from './schema-converter.js';

// Tool provider (orchestrates all services)
export { CustomToolProvider } from './custom-tool-provider.js';

// Unified tool manager (main interface for LLM)
export { ToolManager } from './tool-manager.js';
