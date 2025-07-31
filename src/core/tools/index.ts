/**
 * Tools System for Saiki
 *
 * This module provides the unified tool management system that handles
 * MCP servers and internal tools.
 */

// Core types and interfaces
export type {
    InternalTool,
    ToolExecutionContext,
    ToolSet,
    ToolResult,
    ToolCall,
    ToolProvider,
} from './types.js';

// Internal tools provider
export {
    InternalToolsProvider,
    type InternalToolsServices,
    type InternalToolsConfig,
} from './internal-tools-provider.js';

// Unified tool manager (main interface for LLM)
export { ToolManager, type ToolManagerOptions } from './tool-manager.js';
