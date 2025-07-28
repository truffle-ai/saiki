# Technical Plan: Session Management for Saiki

_This document details the technical steps required to implement the session-management feature described in [feature-plans/session-management.md](../feature-plans/session-management.md)._

---

## 1. Introduction & Scope

We will introduce a **SessionManager** layer and an **ISessionStore** abstraction to manage persistent conversation state, support branching, and maintain history independently of any LLM provider. This plan covers:

- Defining store and manager interfaces
- Providing an in-memory reference store
- Implementing SessionManager orchestration
- Wiring into DI/composition root

---

## 2. Pre-requisite Implementation Steps

### 2.1 Define `ISessionStore`
- Create `src/session/types.ts` with:
  ```typescript
  import { InternalMessage } from '../ai/llm/messages/types';  // use correct path
  
  export interface BranchMetadata {
    branchId: string;
    createdAt: Date;
    label?: string;
  }

  export interface ISessionStore {
    createSession(): Promise<{ sessionId: string; branchId: string }>;
    listBranches(sessionId: string): Promise<BranchMetadata[]>;
    getHistory(sessionId: string, branchId: string): Promise<InternalMessage[]>;
    appendMessage(
      sessionId: string,
      branchId: string,
      msg: InternalMessage
    ): Promise<void>;
    /**
     * Creates a new branch with history sliced up to, but not including, upToMessageIndex.
     * Throws if upToMessageIndex is out of bounds.
     */
    branch(
      sessionId: string,
      fromBranchId: string,
      upToMessageIndex: number
    ): Promise<string>;
  }
  ```

### 2.2 Implement `InMemorySessionStore`
- Create `src/session/in-memory-store.ts` with a concrete implementation:
  ```typescript:path=src/session/in-memory-store.ts
  import { v4 as uuidv4 } from 'uuid';
  import { ISessionStore, BranchMetadata } from './types';
  import { InternalMessage } from '../ai/llm/messages/types';

  export class InMemorySessionStore implements ISessionStore {
    private data = new Map<string, Map<string, InternalMessage[]>>();

    async createSession(): Promise<{ sessionId: string; branchId: string }> {
      const sessionId = uuidv4();
      const branchId = uuidv4();
      this.data.set(sessionId, new Map([[branchId, []]]));
      return { sessionId, branchId };
    }

    async listBranches(sessionId: string): Promise<BranchMetadata[]> {
      const branches = this.data.get(sessionId) ?? new Map();
      return [...branches.keys()].map(branchId => ({
        branchId,
        createdAt: new Date(),
        label: undefined,
      }));
    }

    async getHistory(sessionId: string, branchId: string): Promise<InternalMessage[]> {
      const branches = this.data.get(sessionId);
      if (!branches) throw new Error(`Session not found: ${sessionId}`);
      const history = branches.get(branchId);
      if (!history) throw new Error(`Branch not found: ${branchId}`);
      return [...history]; // return copy
    }

    async appendMessage(
      sessionId: string,
      branchId: string,
      msg: InternalMessage
    ): Promise<void> {
      const branches = this.data.get(sessionId);
      if (!branches) throw new Error(`Session not found: ${sessionId}`);
      const history = branches.get(branchId);
      if (!history) throw new Error(`Branch not found: ${branchId}`);
      history.push(msg);
    }

    async branch(
      sessionId: string,
      fromBranchId: string,
      upToMessageIndex: number
    ): Promise<string> {
      const branches = this.data.get(sessionId);
      if (!branches) throw new Error(`Session not found: ${sessionId}`);
      const source = branches.get(fromBranchId);
      if (!source) throw new Error(`Branch not found: ${fromBranchId}`);
      const newBranchId = uuidv4();
      branches.set(newBranchId, source.slice(0, upToMessageIndex));
      return newBranchId;
    }
  }
  ```

### 2.3 Build `SessionManager`
- Create `src/session/SessionManager.ts`, injecting a formatter factory instead of placeholder:
  ```typescript
  import { ILLMService } from '../ai/llm/services/types';
  import { ContextManager } from '../ai/llm/messages/manager';
  import { ISessionStore, BranchMetadata } from './types';
  import { IFormatter, ITokenizer } from '../ai/llm/messages/formatters/types';

  export class SessionManager {
    constructor(
      private store: ISessionStore,
      private createLLMService: () => ILLMService,
      private formatterFactory: (tokenizer: ITokenizer) => IFormatter,
      private tokenizer: ITokenizer
    ) {}

    /** Create a new session and return sessionId + branchId */
    async start(): Promise<{ sessionId: string; branchId: string }> {
      return this.store.createSession();
    }

    /**
     * Send a user message, replay history, and persist deltas.
     * Returns the branchId (unchanged) and LLM response text.
     */
    async sendMessage(
      sessionId: string,
      branchId: string,
      userText: string
    ): Promise<{ branchId: string; response: string }> {
      const history = await this.store.getHistory(sessionId, branchId);

      // instantiate new ContextManager per branch
      const formatter = this.formatterFactory(this.tokenizer);
      const mgr = new ContextManager(formatter, /*toolProviders*/ [], /*maxTokens*/ 8192, this.tokenizer);

      history.forEach(m => mgr.addMessage(m));
      mgr.addUserMessage(userText);

      const llm = this.createLLMService();
      // completeTask should accept only userText; history is managed by ContextManager
      const reply = await llm.completeTask(userText);

      mgr.processLLMResponse(reply);
      const newMsgs = mgr.getHistory().slice(history.length);
      for (const msg of newMsgs) {
        await this.store.appendMessage(sessionId, branchId, msg);
      }

      return { branchId, response: reply };
    }

    /** Branch a session: slice prior history up to index (exclusive) */
    async branch(
      sessionId: string,
      fromBranchId: string,
      upToMessageIndex: number
    ): Promise<string> {
      return this.store.branch(sessionId, fromBranchId, upToMessageIndex);
    }

    /** List all branch metadata for a session */
    async listBranches(sessionId: string): Promise<BranchMetadata[]> {
      return this.store.listBranches(sessionId);
    }
  }
  ```

### 2.4 Integrate with DI / Composition Root
- In `src/utils/service-initializer.ts`, import the formatter factory and tokenizer type:
  ```diff
  + import { createFormatter } from '../ai/llm/messages/formatters';
  + import { ITokenizer } from '../ai/llm/messages/formatters/types';
  ```
- Adapt `createAgentServices` to wire only the `SessionManager`:
  ```diff path=src/utils/service-initializer.ts
     // 6. Initialize session store and manager
     const sessionStore = overrides?.sessionStore ?? new InMemorySessionStore();
     // derive tokenizer and formatter factory from ContextManager factory
     const tokenizer = mmFactory().getTokenizer();
     const formatterFactory = (tk: ITokenizer) => createFormatter(config.llm.formatter, tk);
     const sessionManager = new SessionManager(
       sessionStore,
       llmFactory,
       formatterFactory,
       tokenizer
     );
  ```

---

## 3. Testing Strategy

- **Unit Tests** for:
  - `InMemorySessionStore`: create, append, branch, listBranches, getHistory.
  - `SessionManager`: correct hydration, delta persistence, branching logic.
- **Integration Tests**:
  - Simulate a conversation flow: start session → sendMessage x3 → branch at index 2 → sendMessage on each branch → verify divergent histories.
  - Verify `VercelLLMService` receive correct formatted messages when driven through `SessionManager`.
- **Edge Cases**:
  - Branching at index 0 (empty history).
  - Appending tool calls and tool results via `ContextManager`.

---

## 4. Documentation Tasks

- Add `src/session/README.md` describing:
  - Session concepts (sessionId, branchId)
  - Store implementations and configuration
  - API examples using `SessionManager`
- Update overall architecture diagram to include SessionManager and store layer.

---

## 5. Migration Steps

1. Merge new files under `src/session/`.
2. Wire DI container to use `SessionManager` throughout the agent entrypoint.
3. Deprecate direct use of `ContextManager` in application code.

---

## 6. Open Questions / TODOs

- Should we support attaching metadata (userId, labels) on branches?
- How to handle cleanup or TTL for session data in persistent stores?
- Performance considerations for very long histories (pagination, pruning).
- API versioning or migration paths if `ISessionStore` changes.

---

## 7. Future Refactor: Decouple ContextManager from LLMService

In a future major version, we plan to fully separate conversation formatting and history management from the LLM provider layer. Key changes will include:

- **Change `ILLMService` interface** to accept pre-formatted `CoreMessage[]` and `ToolSet` directly, returning a raw LLM response object.
- **Remove** any `ContextManager` calls from provider implementations (e.g., `VercelLLMService`, Anthropic services).
- **Refactor factories** in `service-initializer.ts` to wire both a `ConversationManager` (handling history, formatting, branching) and a bare `LLMService`.
- **Implement** a shared `IConversationManager` interface to unify ephemeral and session-based message flows.
- **Migrate** existing code to use `SessionManager` or `ConversationManager` APIs instead of direct `contextManager` calls.

This refactor will provide the cleanest separation of concerns but requires breaking changes across the service layer. It will be scheduled after the initial factory-based session-manager rollout.

*This concludes the technical plan. Proceed to review and refinement before development.* 