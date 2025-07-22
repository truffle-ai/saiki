/**
 * Custom Tools System for Saiki
 *
 * This module provides a decorator-like system for creating custom tools that work alongside MCP servers.
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
export {
    tool,
    createTool,
    getRegisteredTools,
    getRegisteredTool,
    clearRegisteredTools,
    isToolRegistered,
    validateToolResult,
} from './decorators.js';

export type { ToolOptions, ParameterOptions } from './decorators.js';

// Tool manager
export { CustomToolManager } from './manager.js';
