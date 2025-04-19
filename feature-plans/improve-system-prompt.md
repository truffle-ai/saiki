# PRD: Modular System Prompt Pipeline

## 1. Problem Statement
Today, we manage the system prompt as a single static string in `MessageManager`. This monolithic approach:

- Makes it hard to insert, reorder, or tune individual pieces (e.g. persona, safety, memory).  
- Prevents dynamic recomputation of segments at different cadences.  
- Limits extensibility for future features (RAG, templating, per-provider tweaks).

We need a modular, configurable pipeline for assembling the system prompt from discrete "segments," each with its own recompute frequency.

## 2. Objectives

1. Break the system prompt into independent segments (contributors).
2. Support per-session, per-message, and interval-based recomputation.
3. Preserve the existing static prompt as a legacy segment.
4. Provide a simple registration mechanism (code-side today, file-driven later).
5. Ensure seamless migration with minimal service disruption.
6. Keep the solution provider-agnostic (no per-LLM variations).

## 3. High-Level Architecture

```text
┌─────────────────────────────────────────────────────┐
│                 SystemPromptBuilder                │
│  - holds list of ISystemPromptContributor instances │
│  - caches segments by frequency metadata            │
│  - builds final prompt string on demand             │
└─────────────────────────────────────────────────────┘
               ▲                ▲            ▲
     perSession │   onInterval  │  perMessage │
               │                │            │
┌──────────────┴───┐  ┌─────────┴─────┐  ┌─────┴────────────────┐
│ OriginalPromptContributor │  │ MemorySummary │  │ DateTimeContributor │
│ (legacy prompt)           │  │ Contributor    │  │ Contributor         │
└───────────────────────────┘  └───────────────┘  └──────────────────────┘
   (other segments registered similarly)               
```

## 4. API / Interface Definitions

```ts
// src/ai/systemPrompt/types.ts
export type Frequency = 'perSession' | 'perMessage' | 'onInterval';

export interface PromptContext {
  sessionId: string;
  messageCount: number;
  lastIntervalTs: number;
}

export interface SegmentResult {
  text: string;
  vars?: Record<string, string>;
}

export interface ISystemPromptContributor {
  readonly name: string;
  readonly frequency: Frequency;
  readonly intervalMs?: number;
  getSegment(ctx: PromptContext): Promise<SegmentResult>;
}
```

## 5. Configuration & Extensibility

**Phase 1 (code-side):**  
- Contributors are imported and instantiated in code (startup file).  

**Phase 2 (file-driven):**  
- Define a JSON/YAML schema listing contributor module paths, order, and frequency.  
- Dynamically `import()` each module and instantiate with parameters.  

## 6. Migration Plan

1. Create `OriginalPromptContributor` and wire it as the first segment (holds the current custom prompt).  
2. Implement the builder and types alongside tests.  
3. Refactor each LLM service (Vercel, OpenAI, Anthropic) to accept `SystemPromptBuilder`.  
4. Build & inject new prompt segments in `completeTask` flows.  
5. Verify that existing behaviors remain unchanged.

## 7. Testing & Rollout Strategy

- **Unit tests** for:  
  - Core types and builder caching logic.  
  - Each contributor's `getSegment`.  

- **Integration tests** _(optional)_:  
  - Full conversation flow, mocking contributors.  

- **Staging rollout** _(optional)_:  
  - Deploy alongside old code path behind a feature flag.  
  - Gradually switch traffic to new pipeline.  

- **Monitoring** _(optional)_:  
  - Alert if prompt-building errors or latency spikes.

## 8. Detailed Task List

### 8.1 Core Types & Interfaces

- **T1**: Create `src/ai/systemPrompt/types.ts` with `Frequency`, `PromptContext`, `SegmentResult`, `ISystemPromptContributor`.
- **T2**: Write unit tests for `types.ts` (basic instantiation & type guards).

### 8.2 Builder Implementation

- **T3**: Implement `SystemPromptBuilder` in `src/ai/systemPrompt/SystemPromptBuilder.ts` (caching by frequency).
- **T4**: Write unit tests for builder:  
  - Validate per-session cache clears only on reset.  
  - Validate interval caching honors `intervalMs`.  
  - Validate per-message always recomputes.

### 8.3 Contributor Implementations

- **T5**: Create `OriginalPromptContributor` for legacy prompt (`perSession`).
- **T6**: Implement `PersonaContributor` (`perSession`).
- **T7**: Implement `SafetyInstructionsContributor` (`perSession`).
- **T8**: Implement `DomainKnowledgeContributor` (`perSession`).
- **T9**: Implement `MemorySummaryContributor` (`onInterval`, configurable).  
- **T10**: Implement `RagKnowledgeContributor` (`perMessage` or `onInterval`).
- **T11**: Implement `DateTimeContributor` (`perMessage`).
- **T12**: Write unit tests for each contributor (happy path & error cases).

### 8.4 Service Integration

- **T13**: Refactor `VercelLLMService` to:  
  - Accept `SystemPromptBuilder` in constructor.  
  - Maintain `PromptContext`.  
  - Rebuild and `setSystemPrompt` on each `completeTask` invocation.
- **T14**: Apply same changes to `OpenAILLMService`.
- **T15**: Apply same changes to `AnthropicLLMService`.
- **T16**: Update `ILLMService` interface (`updateSystemContext` may be deprecated).

### 8.5 Phase 2: Config-Driven Registry (Optional)

- **T17**: Design JSON/YAML config schema (`feature-docs/system-prompt-schema.md`).
- **T18**: Implement `src/ai/systemPrompt/config.ts` to load & validate config.  
- **T19**: Integrate config loader into builder initialization.
- **T20**: Write integration tests for config-driven registry.

### 8.6 Documentation & Examples

- **T21**: Add `README.md` in `src/ai/systemPrompt`, describing how to add new contributors.  
- **T22**: Provide a sample `system-prompt.config.json` for Phase 2.
- **T23**: Update top-level project docs to reference new feature.

### 8.7 End-to-End Testing & CI

- **T24**: Create an end-to-end test simulating a conversation with multiple messages, validating the final prompt content.
- **T25**: Ensure CI pipeline installs and runs all new tests, lints new files, and enforces coverage thresholds.

---

*Estimated total effort: 3–5 days of development and testing.* 