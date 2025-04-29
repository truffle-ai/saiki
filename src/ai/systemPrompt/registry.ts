import * as handlers from './in-built-prompts.js';
import { DynamicContributorContext } from './types.js';

/**
 * This file contains the registry of all the source handlers for dynamic contributors for the system prompt.
 */
export type SourceHandler = (context: DynamicContributorContext) => Promise<string>;

export const sourceHandlerRegistry: Record<string, SourceHandler> = {
    dateTime: handlers.getCurrentDateTime,
    memorySummary: handlers.getMemorySummary,
    // Add other handlers here
};

export function getSourceHandler(source: string): SourceHandler | undefined {
    return sourceHandlerRegistry[source];
}
