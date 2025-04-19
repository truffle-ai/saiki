# Technical Plan: Extensible System Context / Prompt Contributors

This document outlines the detailed technical steps required to implement the extensible system prompt contributor feature based on the [feature plan](mdc:../feature-plans/extensible-system-context.md).

## 1. Configuration Changes (`src/config/types.ts`)

1.  **Modify `AgentConfig`:**
    *   Locate the `llm` property within the `AgentConfig` interface.
    *   Change the type of `llm.systemPrompt` from `string` to `string | SystemPromptConfig`.
    *   Add a new optional property `memory?: MemoryConfig;` to `AgentConfig` (and other dynamic source configs as needed later).

2.  **Define `SystemPromptConfig` Interface:**
    ```typescript
    export interface ContributorConfig {
      /** Unique identifier for the contributor (e.g., 'dateTime', 'userInstructions', 'memorySummary') */
      id: string;
      /** Determines the type of contributor */
      type: 'static' | 'dynamic';
      /** Execution order (lower numbers run first) */
      priority: number;
      /** Optional flag to explicitly disable this contributor (defaults to true if omitted) */
      enabled?: boolean;
      /** Content for 'static' type contributors */
      content?: string;
      /** Key mapping to a registered source handler for 'dynamic' type contributors */
      source?: string;
    }

    export interface SystemPromptConfig {
      /** List of contributors defining the system prompt structure */
      contributors: ContributorConfig[];
    }
    ```

3.  **Define `MemoryConfig` Interface (Example):**
    ```typescript
    export interface MemoryConfig {
      /** The memory provider implementation to use */
      provider: 'in-memory' | 'redis' | 'none'; // Example: Add more as supported
      /** Optional: Maximum token limit for memory summary/context */
      maxTokens?: number;
      /** Optional: Strategy for retrieving/summarizing memory */
      retrievalStrategy?: 'summary' | 'recent' | 'semantic'; // Example strategies
      /** Optional: Connection details for external providers like Redis */
      connectionString?: string; // Example
      // Add other provider-specific options as needed
    }
    ```
    *(Note: The actual implementation of memory providers is outside the scope of *this* specific plan but the config structure is needed).*

## 2. Core Component Implementation

1.  **Define `SystemPromptContributor` Interface (`src/ai/systemPrompt/types.ts`):**
    *   Create or ensure this interface exists:
        ```typescript
        import { AgentConfig } from '../../config/types'; // Adjust import path
        import { ClientManager } from '../../client/manager'; // Adjust import path

        // Define a minimal context type passed to dynamic handlers
        // Add properties as needed by different handlers
        export interface DynamicContributorContext {
          agentConfig: AgentConfig;
          clientManager: ClientManager;
          // Add other necessary dependencies like message history access if needed
        }

        export interface SystemPromptContributor {
          id: string;
          priority: number;
          /** Asynchronously gets the content string for this contributor. */
          getContent(context: DynamicContributorContext): Promise<string>;
        }
        ```

2.  **Implement Base Classes (`src/ai/systemPrompt/contributors/base.ts` - New File):**
    ```typescript
    import { SystemPromptContributor, DynamicContributorContext } from '../types';

    export class StaticContributor implements SystemPromptContributor {
      readonly id: string;
      readonly priority: number;
      private readonly staticContent: string;

      constructor(id: string, priority: number, content: string) {
        this.id = id;
        this.priority = priority;
        this.staticContent = content;
      }

      async getContent(_context: DynamicContributorContext): Promise<string> {
        // Static contributors ignore the context
        return this.staticContent;
      }
    }

    export class DynamicContributor implements SystemPromptContributor {
      readonly id: string;
      readonly priority: number;
      private readonly sourceHandler: (context: DynamicContributorContext) => Promise<string>;

      constructor(id: string, priority: number, handler: (context: DynamicContributorContext) => Promise<string>) {
        this.id = id;
        this.priority = priority;
        this.sourceHandler = handler;
      }

      async getContent(context: DynamicContributorContext): Promise<string> {
        // Delegate content generation to the registered source handler
        return this.sourceHandler(context);
      }
    }
    ```

3.  **Implement Source Handlers (`src/ai/systemPrompt/contributors/handlers.ts` - New File):**
    *   Extract logic from PR #62 contributors.
    *   Define functions matching the `(context: DynamicContributorContext) => Promise<string>` signature.
    ```typescript
    import { DynamicContributorContext } from '../types';
    import { logger } from '../../../utils/logger'; // Adjust path

    // --- Example Handlers ---

    export async function getCurrentDateTime(_context: DynamicContributorContext): Promise<string> {
      logger.debug('[SystemPrompt] Getting current date/time contributor content.');
      return `Current date and time: ${new Date().toISOString()}`;
    }

    export async function getMemorySummary(context: DynamicContributorContext): Promise<string> {
      logger.debug('[SystemPrompt] Getting memory summary contributor content.');
      const memoryConfig = context.agentConfig.memory;
      if (!memoryConfig || memoryConfig.provider === 'none') {
        return ''; // No memory configured or enabled
      }
      // TODO: Implement actual memory fetching logic based on memoryConfig
      // This will likely involve a separate MemoryService not defined here.
      // Example placeholder:
      return `Memory Summary (Provider: ${memoryConfig.provider}): [Placeholder - Implement memory fetching]`;
    }

    export async function getUserInstructions(context: DynamicContributorContext): Promise<string> {
        logger.debug('[SystemPrompt] Getting user instructions contributor content.');
        // Example: Assuming base instructions are stored in a specific way or passed via context
        // This might involve looking up a specific 'static' contributor content if we model it that way
        // Or retrieving from a dedicated field if added to AgentConfig/Context
        // Placeholder:
         if (typeof context.agentConfig.llm.systemPrompt === 'object' && context.agentConfig.llm.systemPrompt.contributors.find(c => c.id === 'userInstructions' && c.type === 'static')) {
             return context.agentConfig.llm.systemPrompt.contributors.find(c => c.id === 'userInstructions' && c.type === 'static')?.content || '';
         }
         // If legacy string prompt is used, it will be handled separately by the loader.
         return ''; // Default if no specific instructions contributor found
    }

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
    ```

4.  **Implement Source Registry (`src/ai/systemPrompt/contributors/registry.ts` - New File):**
    ```typescript
    import { DynamicContributorContext } from '../types';
    import * as handlers from './handlers'; // Import all handlers

    export type SourceHandler = (context: DynamicContributorContext) => Promise<string>;

    export const sourceHandlerRegistry: Record<string, SourceHandler> = {
      'dateTime': handlers.getCurrentDateTime,
      'memorySummary': handlers.getMemorySummary,
      'userInstructions': handlers.getUserInstructions, // Example if handled dynamically
      'toolListing': handlers.getToolListing,
      // Add other source keys and their corresponding handler functions
      // 'persona': handlers.getPersona,
      // 'ragKnowledge': handlers.getRagKnowledge,
    };

    export function getSourceHandler(source: string): SourceHandler | undefined {
      return sourceHandlerRegistry[source];
    }
    ```

## 3. Contributor Loading & Merging (`src/ai/llm/messages/manager.ts` or new `ContributorLoader` class)

1.  **Define Default Contributors:**
    *   Inside `MessageManager` or a dedicated loader class, define the default set:
        ```typescript
        const defaultContributors: ContributorConfig[] = [
          { id: 'dateTime', type: 'dynamic', priority: 10, source: 'dateTime', enabled: true },
          // Add other defaults like base instructions or safety prompts if desired
          // { id: 'baseInstructions', type: 'static', priority: 0, content: 'You are Saiki...', enabled: true },
        ];
        ```

2.  **Implement Loading Logic:**
    *   Create a method `loadContributors(systemPromptConfig: string | SystemPromptConfig): SystemPromptContributor[]`.
    *   **Handle Legacy String:** If input is a string, return `[new StaticContributor('legacyPrompt', 0, systemPromptConfig)]`.
    *   **Handle Config Object:**
        *   Get `userConfigs = systemPromptConfig.contributors`.
        *   Perform the merge:
            *   Start with a copy of `defaultContributors`.
            *   Iterate through `userConfigs`. If a user config `id` matches a default `id`, replace the default entry with the user's entry. If it doesn't match any default, add the user's entry to the list.
            *   Filter out any contributor where `enabled === false`.
        *   Instantiate `SystemPromptContributor` objects:
            *   Iterate through the final merged/filtered `ContributorConfig` list.
            *   For `type: 'static'`, create `new StaticContributor(config.id, config.priority, config.content || '')`. Handle missing content error.
            *   For `type: 'dynamic'`, look up the handler using `getSourceHandler(config.source)`. If found, create `new DynamicContributor(config.id, config.priority, handler)`. Handle missing source or handler errors.
        *   Return the list of instantiated `SystemPromptContributor` objects.

## 4. Dependency Injection & Integration

1.  **Modify `LLMService` Constructors (e.g., `src/ai/llm/services/vercel.ts`):**
    *   Ensure constructors accept the full `AgentConfig` and `ClientManager`.
    *   Pass these dependencies to the `MessageManager` constructor.

2.  **Modify `MessageManager` Constructor:**
    *   Accept `agentConfig: AgentConfig`, `clientManager: ClientManager` (and existing parameters like `formatter`, `tokenizer`, `maxTokens`). Store these internally.
    *   In the constructor, call `this.contributors = this.loadContributors(agentConfig.llm.systemPrompt)`.

3.  **Modify `MessageManager.getFormattedMessages` (or where prompt is built):**
    *   Before constructing the final message list for the LLM:
        *   Prepare the `dynamicContext: DynamicContributorContext = { agentConfig: this.agentConfig, clientManager: this.clientManager /*, ... */ }`.
        *   Sort `this.contributors` by `priority`.
        *   Generate content: `const promptParts = await Promise.all(this.contributors.map(c => c.getContent(dynamicContext)))`.
        *   Filter out empty parts.
        *   Construct the final system prompt string: `const systemPromptString = promptParts.join('\n\n');` (or other separator).
        *   Use this `systemPromptString` when formatting messages for the LLM (replacing the previously static system prompt).

## 5. Refactoring and Cleanup

1.  **Remove Old Contributor Classes:** Delete the specific contributor class files from PR #62 (e.g., `src/ai/systemPrompt/contributors/DateTimeContributor.ts`).
2.  **Remove Old `SystemPromptBuilder` / `SystemPromptRegistry`:** Delete or refactor these files from PR #62 as their functionality is now integrated into `MessageManager` and the new registry/handler structure.
3.  **Update `app/index.ts` Validation:** Modify `validateAgentConfig` to handle the new `systemPrompt` structure (checking if it's string or object and validating the object structure if present).
4.  **Testing:** Add unit tests for:
    *   `StaticContributor` and `DynamicContributor` base classes.
    *   Individual source handler functions (mocking context).
    *   The `loadContributors` logic (including merging, legacy handling, error cases).
    *   `MessageManager` integration (ensure prompt is built correctly with different configs).

## 6. Documentation

1.  Update `README.md` or relevant documentation.
2.  Explain the new `systemPrompt` configuration format in `saiki.config.json`.
3.  List the available built-in `source` types for dynamic contributors (`dateTime`, `memorySummary`, etc.).
4.  Provide examples of how to customize the system prompt (adding, removing, reordering contributors).
5.  Document the default contributors and their priorities.
6.  Explain how to configure dynamic sources (e.g., the `memory` section). 