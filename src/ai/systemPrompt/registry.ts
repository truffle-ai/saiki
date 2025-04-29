import * as handlers from './in-built-prompts.js';
import { DynamicContributorContext } from './types.js';

export type SourceHandler = (context: DynamicContributorContext) => Promise<string>;

export const sourceHandlerRegistry: Record<string, SourceHandler> = {
  dateTime: handlers.getCurrentDateTime,
  memorySummary: handlers.getMemorySummary,
  userInstructions: handlers.getUserInstructions,
  toolListing: handlers.getToolListing,
};

export function getSourceHandler(source: string): SourceHandler | undefined {
  return sourceHandlerRegistry[source];
} 