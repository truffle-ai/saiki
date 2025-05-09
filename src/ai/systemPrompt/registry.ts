import * as handlers from './in-built-prompts.js';
import { DynamicContributorContext } from './types.js';

/**
 * This file contains the registry of all the functions that can generate dynamic prompt pieces at runtime.
 */
export type DynamicPromptGenerator = (context: DynamicContributorContext) => Promise<string>;

export const dynamicPromptGenerators: Record<string, DynamicPromptGenerator> = {
    dateTime: handlers.getCurrentDateTime,
    memorySummary: handlers.getMemorySummary,
    // Add other functions that generate prompts here
} as const;

// This type is mainly for easier understanding of the code - links to ContributorConfig type
export type PromptGeneratorKey = keyof typeof dynamicPromptGenerators;

// To fetch a prompt generator function from its name
export function getPromptGenerator(
    promptGeneratorKey: PromptGeneratorKey
): DynamicPromptGenerator | undefined {
    return dynamicPromptGenerators[promptGeneratorKey];
}

// To register a new prompt generator function
export function registerPromptGenerator(
    promptGeneratorKey: string,
    promptGenerator: DynamicPromptGenerator
) {
    dynamicPromptGenerators[promptGeneratorKey] = promptGenerator;
}
