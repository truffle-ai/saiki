import { AgentConfig, ContributorConfig, SystemPromptConfig } from '../../config/types.js';
import { ClientManager } from '../../client/manager.js';

/**
 * Context passed to dynamic system prompt contributors.
 * Extend as needed for additional dependencies (e.g., message history).
 */
export interface DynamicContributorContext {
  agentConfig: AgentConfig;
  clientManager: ClientManager;
  // Add other necessary dependencies here
}

/**
 * Interface for a system prompt contributor (static or dynamic).
 */
export interface SystemPromptContributor {
  id: string;
  priority: number;
  /**
   * Asynchronously gets the content string for this contributor.
   * @param context - The dynamic context for content generation
   */
  getContent(context: DynamicContributorContext): Promise<string>;
} 