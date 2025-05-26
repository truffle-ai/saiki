import { AgentConfig } from '../../config/schemas.js';
import { MCPClientManager } from '../../client/manager.js';

// Context passed to dynamic contributors
export interface DynamicContributorContext {
    clientManager: MCPClientManager;
}

// Interface for all system prompt contributors
export interface SystemPromptContributor {
    id: string;
    priority: number;
    getContent(context: DynamicContributorContext): Promise<string>;
}
