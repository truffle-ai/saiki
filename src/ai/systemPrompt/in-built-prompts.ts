import { DynamicContributorContext } from './types.js';

/**
 * Dynamic Prompt Generators
 *
 * This module contains functions for generating dynamic system prompts for the AI agent.
 * Each function should return a string (or Promise<string>) representing a prompt, possibly using the provided context.
 *
 * ---
 * Guidelines for Adding Prompt Functions:
 * - Place all dynamic prompt-generating functions in this file.
 * - Also update the `registry.ts` file to register the new function.
 * - Use XML tags to indicate the start and end of the dynamic prompt - they are known to improve performance
 * - Each function should be named clearly to reflect its purpose (e.g., getCurrentDateTime, getMemorySummary).
 */

export async function getCurrentDateTime(_context: DynamicContributorContext): Promise<string> {
  return `<dateTime>Current date and time: ${new Date().toISOString()}</dateTime>`;
}

export async function getMemorySummary(_context: DynamicContributorContext): Promise<string> {
  // Placeholder for actual memory logic
  return '<memorySummary>Memory summary: [not implemented]</memorySummary>';
}
