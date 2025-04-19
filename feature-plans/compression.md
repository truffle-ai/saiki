# Refactoring Message Compression using the Strategy Pattern

**Status:** Proposed
**Owner:** [Your Name/Team]
**Date:** 2024-07-26

## Overview

The current `MessageManager` implements conversation history compression logic directly within its private methods (`applyMiddleRemovalCompression`, `applyOldestRemovalCompression`). This approach tightly couples the compression algorithms to the manager class, making it less flexible and harder to extend with new strategies.

This plan proposes refactoring the compression mechanism to use the **Strategy design pattern**. This will encapsulate each compression algorithm into its own class, allowing `MessageManager` to dynamically use different strategies without modifying its core logic.

## Goals

*   Decouple compression algorithms from the `MessageManager` class.
*   Improve flexibility by allowing different compression strategies (or combinations/orders) to be injected into `MessageManager`.
*   Enhance maintainability by isolating compression logic into separate, focused classes.
*   Make the system extensible, allowing new compression strategies to be added easily without modifying `MessageManager`.
*   Make compression strategies configurable (e.g., number of messages to preserve).

## Non-Goals

*   Implementing new compression algorithms beyond the existing middle-removal and oldest-removal logic at this stage.
*   Changing the core logic of how token counting works.
*   Changing the `IMessageFormatter` or `ITokenizer` interfaces.

## Proposed Solution

1.  **Define `ICompressionStrategy` Interface:**
    *   Create an interface `ICompressionStrategy` with a single method: `compress(history: InternalMessage[], tokenizer: ITokenizer, maxTokens: number): InternalMessage[]`.
    *   This interface will define the contract for all compression algorithms.

2.  **Implement Concrete Strategy Classes:**
    *   Create `MiddleRemovalStrategy` implementing `ICompressionStrategy`.
        *   Move the logic from the current `applyMiddleRemovalCompression` into this class's `compress` method.
        *   Make parameters like `preserveStart` and `preserveEnd` configurable via the constructor, providing sensible defaults (e.g., `preserveStart = 4`, `preserveEnd = 5`).
    *   Create `OldestRemovalStrategy` implementing `ICompressionStrategy`.
        *   Move the logic from the current `applyOldestRemovalCompression` into this class's `compress` method.
        *   Make parameters like `minMessagesToKeep` configurable via the constructor, providing a sensible default (e.g., `minMessagesToKeep = 4`).

3.  **Refactor `MessageManager`:**
    *   Add a new constructor parameter `compressionStrategies: ICompressionStrategy[]`.
    *   Provide a default value for this parameter, instantiating the `MiddleRemovalStrategy` and `OldestRemovalStrategy` in the current preferred order: `[new MiddleRemovalStrategy(), new OldestRemovalStrategy()]`.
    *   Add JSDoc comments explaining that the order of strategies in the array matters and dictates the sequence of application.
    *   Store the provided strategies in a private member variable (e.g., `this.compressionStrategies`).
    *   Modify the `compressHistoryIfNeeded` method:
        *   Remove the direct calls to `applyMiddleRemovalCompression` and `applyOldestRemovalCompression`.
        *   Instead, iterate through `this.compressionStrategies`.
        *   In each iteration, call the `compress` method of the current strategy, passing the current history, tokenizer, and maxTokens.
        *   Update the `this.history` with the result returned by the strategy.
        *   Recalculate the token count after applying a strategy.
        *   If the token count is within the limit, break the loop.
    *   Remove the now-unused private methods `applyMiddleRemovalCompression` and `applyOldestRemovalCompression`.

4.  **File Structure:**
    *   Create a new directory: `src/ai/llm/messages/compression/`.
    *   Place `ICompressionStrategy.ts` (or `interface.ts`), `middle-removal.ts`, and `oldest-removal.ts` within this directory.

## Alternatives Considered

*   **Keeping Logic In-Class:** Maintaining the current approach. Rejected because it lacks flexibility and violates the Single Responsibility Principle.
*   **Functional Approach:** Passing compression functions instead of strategy objects. Considered slightly less object-oriented and potentially less clear for managing stateful configuration within strategies if needed later. The Strategy pattern felt like a more standard and explicit fit here.

## Implementation Plan / Task List

*   [x] Create directory `src/ai/llm/messages/compression/`.
*   [x] Define `ICompressionStrategy` interface in `src/ai/llm/messages/compression/types.ts`.
*   [x] Implement `MiddleRemovalStrategy` class in `src/ai/llm/messages/compression/middle-removal.ts`, making it configurable and adding JSDocs.
*   [x] Implement `OldestRemovalStrategy` class in `src/ai/llm/messages/compression/oldest-removal.ts`, making it configurable and adding JSDocs.
*   [x] Update `MessageManager` constructor (`src/ai/llm/messages/manager.ts`) to accept `ICompressionStrategy[]` with defaults and JSDocs.
*   [x] Refactor `MessageManager.compressHistoryIfNeeded` method to use the injected strategies.
*   [x] Remove old private compression methods (`applyMiddleRemovalCompression`, `applyOldestRemovalCompression`) from `MessageManager`.
*   [x] Create token counting utility function in `src/ai/llm/messages/utils.ts`.
*   [x] Refactor compression strategies to use the new utility function.
*   [-] Add/update unit tests for the new strategy classes. (Skipped for now)
*   [-] Add/update unit tests for `MessageManager` to verify strategy application and ordering. (Skipped for now)
*   [-] Update relevant documentation (if any beyond this plan) (Skipped for now).

## Open Questions

*   None currently identified. 