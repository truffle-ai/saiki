import { DynamicContributorContext } from './types.js';
import * as handlers from './in-built-prompts.js';
import { logger } from '../../utils/logger.js';
export type SourceHandler = (context: DynamicContributorContext) => Promise<string>;

/**
 * Registry mapping source keys to handler functions for dynamic contributors.
 */
export const sourceHandlerRegistry: Record<string, SourceHandler> = {
  dateTime: handlers.getCurrentDateTime,
  memorySummary: handlers.getMemorySummary,
  userInstructions: handlers.getUserInstructions,
  toolListing: handlers.getToolListing,
  // Add other source keys and their corresponding handler functions as needed
  // persona: handlers.getPersona,
  // ragKnowledge: handlers.getRagKnowledge,
};

/**
 * Utility to look up a handler by source key.
 */
export function getSourceHandler(source: string): SourceHandler {
  logger.debug(`getSourceHandler: source: ${source}`);
  if (!source || typeof source !== 'string') {
    throw new Error('Source must be a non-empty string');
  }
  
  const handler = sourceHandlerRegistry[source];
  if (!handler) {
    throw new Error(`No handler found for source: ${source}`);
  }
  
  return handler;
} 