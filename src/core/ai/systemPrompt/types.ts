import { MCPManager } from '../../client/manager.js';

// Context passed to dynamic contributors
export interface DynamicContributorContext {
    clientManager: MCPManager;
}

// Interface for all system prompt contributors
export interface SystemPromptContributor {
    id: string;
    priority: number;
    getContent(context: DynamicContributorContext): Promise<string>;
}
