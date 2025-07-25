import { MCPManager } from '../../client/manager.js';

// Context passed to dynamic contributors
export interface DynamicContributorContext {
    mcpManager: MCPManager;
    // Model information for formatters - used for model-aware file filtering
    llmProvider?: string;
    llmModel?: string;
}

// Interface for all system prompt contributors
export interface SystemPromptContributor {
    id: string;
    priority: number;
    getContent(context: DynamicContributorContext): Promise<string>;
}
