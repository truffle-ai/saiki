import { DynamicContributorContext } from './types.js';
import { logger } from '../../utils/logger.js';

// --- Example Handlers ---

/**
 * Returns the current date and time as an ISO string.
 */
export async function getCurrentDateTime(_context: DynamicContributorContext): Promise<string> {
  logger.debug('[SystemPrompt] Getting current date/time contributor content.');
  return `Current date and time: ${new Date().toISOString()}`;
}

/**
 * Returns a memory summary string, or empty if no memory is configured.
 */
export async function getMemorySummary(context: DynamicContributorContext): Promise<string> {
  logger.debug('[SystemPrompt] Getting memory summary contributor content.');
  const memoryConfig = context.agentConfig.memory;
  if (!memoryConfig || memoryConfig.provider === 'none') {
    return '';
  }
  // TODO: Implement actual memory fetching logic based on memoryConfig
  return `Memory Summary (Provider: ${memoryConfig.provider}): [Placeholder - Implement memory fetching]`;
}

/**
 * Returns user instructions if present as a static contributor in the config.
 */
export async function getUserInstructions(context: DynamicContributorContext): Promise<string> {
  logger.debug('[SystemPrompt] Getting user instructions contributor content.');
  if (
    typeof context.agentConfig.llm.systemPrompt === 'object' &&
    context.agentConfig.llm.systemPrompt.contributors.find(c => c.id === 'userInstructions' && c.type === 'static')
  ) {
    return (
      context.agentConfig.llm.systemPrompt.contributors.find(c => c.id === 'userInstructions' && c.type === 'static')?.content || ''
    );
  }
  return '';
}

/**
 * Returns a comma-separated list of available tool names, or a fallback message.
 */
export async function getToolListing(context: DynamicContributorContext): Promise<string> {
  logger.debug('[SystemPrompt] Getting tool listing contributor content.');
  try {
    const tools = await context.clientManager.getAllTools();
    const toolNames = Object.keys(tools);
    if (toolNames.length === 0) {
      return 'No tools are available.';
    }
    // TODO: Improve formatting, maybe include descriptions?
    return `Available tools: ${toolNames.join(', ')}`;
  } catch (error) {
    logger.error('Failed to get tool listing for system prompt:', error);
    return 'Could not retrieve tool listing.';
  }
}

// --- Add other handlers for Persona, RAG, Safety etc. as needed --- 