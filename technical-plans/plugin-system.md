# Technical Plan: Pluggable Plugin System for Saiki

_This document details the technical steps required to implement the plugin system described in [feature-plans/plugin-system.md](../feature-plans/plugin-system.md)._

---

## 1. Introduction & Scope

This plan covers the implementation of a robust, extensible plugin system for Saiki, enabling users and developers to extend agent behavior via config-registered plugins. The goal is to support a wide range of extension points (prompt contributors, tool servers, confirmation providers, event listeners, etc.) with clear ordering, error handling, and documentation.

---

## 2. Pre-requisite Implementation Steps

### 2.1 Expose All Relevant Services and Extensibility Points
- **Refactor `src/utils/service-initializer.ts`:**
  - Ensure all extensibility points (e.g., `promptContributors`, `toolConfirmationProvider`, `tokenizer`, etc.) are properties on the returned `AgentServices` object.
  - If any are currently internal to subcomponents, refactor to expose them at the top level.
  - Update type definitions for `AgentServices` accordingly.
- **Migration:**
  - Update all usages of `initializeServices` to use the new/expanded `AgentServices` type.

### 2.2 Configurable/Composable Service Construction
- **Update Factories:**
  - In `src/ai/llm/services/factory.ts` and `src/ai/llm/messages/factory.ts`, allow injection of subcomponents (e.g., prompt contributors, compression strategies) via config or code.
  - Update `src/config/types.ts` to support arrays/lists for extensible points (e.g., `promptContributors?: ContributorConfig[]`).
- **Config Schema:**
  - Document and validate new config fields for extensibility points.
- **Migration:**
  - Ensure backward compatibility for existing configs.

### 2.3 Standardize and Document Extensibility Points
- **Finalize Interfaces:**
  - Complete and document interfaces for all extensibility points (e.g., `SystemPromptContributor`, `ToolConfirmationProvider`).
  - Place interface/type definitions in `src/ai/systemPrompt/types.ts` and similar locations.
- **Documentation:**
  - Add JSDoc and markdown docs for each interface, with usage examples for plugin authors.

### 2.4 Plugin Loading Mechanism
- **Plugin Interface:**
  - Define `SaikiPlugin` interface in `src/plugins/types.ts`:
    ```typescript
    export interface SaikiPlugin {
      name: string;
      priority?: number; // Higher runs later
      apply(config: AgentConfig, services: AgentServices): void | Promise<void>;
    }
    ```
- **Plugin Loader:**
  - Implement `src/plugins/loader.ts`:
    - Read plugin paths from config (`plugins` array in `agent.yml`).
    - Support both local files and npm packages.
    - Import/require each plugin, validate interface, and collect into an array.
    - Sort plugins by `priority` (default 0), then by config order.
    - Call each plugin's `apply` method with the current config and services.
    - Catch and handle errors per error handling policy (see below).
- **Integration:**
  - Call the plugin loader after service initialization but before agent startup.
  - Pass the fully-initialized config and services to plugins.

### 2.5 Error Handling and Safety
- **Error Policy:**
  - By default, log plugin errors and skip the failing plugin, unless a config flag (e.g., `failOnPluginError`) is set.
  - Warn if a plugin mutates core invariants or throws synchronously.
- **Isolation:**
  - (Future) Consider running plugins in a restricted context or process if needed for security.

---

## 3. Plugin System Implementation

### 3.1 Plugin Interface & Extensibility Points
- Place the canonical `SaikiPlugin` interface in `src/plugins/types.ts`.
- Document all available extensibility points on the `AgentServices` object.

### 3.2 Plugin Loader
- Implement `src/plugins/loader.ts` as described above.
- Support both ESM and CommonJS plugins (use dynamic `import()` and fallback to `require()` if needed).
- Validate that each plugin exports a valid `SaikiPlugin` object.
- Sort and apply plugins as per priority and config order.

### 3.3 Config Integration
- Update `src/config/types.ts` and config loader to support a `plugins` array.
- Document plugin config format in `agents/README.md`.

### 3.4 Ordering and Priority
- Plugins are sorted by `priority` (higher runs later), then by config order.
- Document this ordering in both code and user docs.

### 3.5 Error Handling
- Wrap each plugin's `apply` call in a try/catch.
- Log errors with plugin name and stack trace.
- If `failOnPluginError` is set, abort startup on error; otherwise, continue.

---

## 4. Migration Steps
- Refactor service initializer and factories as above.
- Update config files and documentation.
- Add sample plugins (e.g., telemetry, custom prompt contributor, tool approval override) in `src/plugins/examples/`.
- Update tests to cover plugin loading, ordering, and error handling.

---

## 5. Testing Strategy
- **Unit Tests:**
  - Test plugin loader with valid, invalid, and error-throwing plugins.
  - Test ordering and priority logic.
  - Test that plugins can mutate/extensify all documented extensibility points.
- **Integration Tests:**
  - Test end-to-end agent startup with multiple plugins.
  - Test config-driven plugin registration.
- **Manual QA:**
  - Add and remove plugins in a real config and verify effects.

---

## 6. Documentation Tasks
- Update `agents/README.md` with plugin config schema and examples.
- Add `src/plugins/README.md` with plugin authoring guide, interface docs, and sample plugins.
- Document all extensibility points and best practices for plugin authors.

---

## 7. Open Questions / TODOs
- Should we support hot-reloading or dynamic plugin loading in the future?
- Should plugins be able to "wrap" (middleware) or only replace/add?
- What are the security implications of third-party plugins?
- Should we support plugin version constraints in config?

---

*This technical plan provides a step-by-step roadmap for implementing the Saiki plugin system. Review and refine as needed before starting development.* 