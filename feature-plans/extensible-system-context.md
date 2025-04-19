# Feature Plan: Extensible System Context / Prompt Contributors

## 1. Goals

*   Make the composition of the LLM's system prompt modular, extensible, and configurable.
*   Allow users to define which components ("contributors") build the final system prompt via the `saiki.config.json` file.
*   Support both static content (fixed strings) and dynamic content (e.g., current date/time, agent memory summary, available tools list) contributions.
*   Maintain backward compatibility for users who currently define `systemPrompt` as a simple string in their configuration.
*   Lay the architectural foundation for more complex agent behaviors (like a gaming agent) by providing clear hooks for injecting dynamic context (e.g., memory, game state, user-provided domain knowledge).

## 2. Tenets

*   **Configuration over Code:** Prioritize user customization through configuration files over requiring direct code modification for common prompt adjustments.
*   **Sensible Defaults:** Provide a default set of useful prompt contributors (like current date/time) that offer good out-of-the-box functionality.
*   **User Override:** Ensure users have complete control to disable, reorder, replace, or add to the default set of contributors via their configuration.
*   **Extensibility:** Design the system so that adding new built-in contributor types/sources is straightforward.
*   **Testability:** Favor Dependency Injection for passing configurations and dependencies to ensure components are easily testable in isolation.

## 3. Proposed Implementation Summary

Based on discussions and review of PR #62, the plan involves transitioning to a configuration-driven contributor model:

1.  **Configuration Schema (`src/config/types.ts`):**
    *   Modify `AgentConfig.llm.systemPrompt` to accept `string | SystemPromptConfig`.
    *   Define `SystemPromptConfig` containing a `contributors: ContributorConfig[]` array.
    *   Define `ContributorConfig` with fields: `id: string` (unique name), `type: 'static' | 'dynamic'`, `priority: number`, `enabled?: boolean` (defaults to true), `content?: string` (for static), `source?: string` (for dynamic).
    *   Add dedicated sections to `AgentConfig` for configuring dynamic sources (e.g., `memory: MemoryConfig`).

2.  **Backward Compatibility:**
    *   If `config.llm.systemPrompt` is a string, internally treat it as a single static contributor: `[{ id: 'legacyPrompt', type: 'static', priority: 0, content: "the string", enabled: true }]`.

3.  **Core Components:**
    *   **Base Classes:** Create `StaticContributor` and `DynamicContributor` classes implementing a common `SystemPromptContributor` interface (`{ id, priority, getContent(context) }`).
    *   **Source Handlers (`src/ai/systemPrompt/in-built-prompts.ts`):** Extract logic from PR #62's contributors into standalone async functions (e.g., `getCurrentDateTime()`, `getMemorySummary(context)`). These functions will perform the actual data fetching/formatting.
    *   **Source Registry (`src/ai/systemPrompt/registry.ts`):** Create a map linking `source` strings (from config, e.g., `"dateTime"`) to their corresponding handler functions.

4.  **Loading & Merging Logic (`MessageManager` or dedicated loader):**
    *   Define a default list of contributors (e.g., `dateTime`).
    *   Load the user's `contributors` array from the configuration.
    *   Merge the default and user lists: user config overrides defaults based on `id`. Respect the `enabled: false` flag to disable defaults.
    *   Instantiate `StaticContributor` or `DynamicContributor` objects for the final, merged list, linking dynamic ones to handlers via the registry.

5.  **Dependency Injection:**
    *   Pass the relevant `AgentConfig` sections (e.g., `llm`, `memory`) and service instances (e.g., `ClientManager`) down from `app/index.ts` -> `LLMService` -> `MessageManager`.

6.  **Runtime Execution:**
    *   `MessageManager` uses the merged/loaded contributor list.
    *   Before calling `SystemPromptBuilder`, it iterates through dynamic contributors.
    *   For each dynamic contributor, it calls the associated source handler, passing only the necessary minimal context (derived from the injected `AgentConfig` and dependencies).
    *   `SystemPromptBuilder` receives the final list of active contributors, sorts by priority, calls `getContent` on each, and assembles the final prompt string.

7.  **Refactoring:**
    *   Remove the specific contributor classes from PR #62 (`DateTimeContributor`, etc.).
    *   Update `SystemPromptBuilder` and `MessageManager` integration points. 