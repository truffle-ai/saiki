# Error Handling Standardization Plan

## Overview

This document outlines the plan to standardize error handling patterns across the Saiki AI agent framework/SDK, moving from inconsistent mixed patterns to a clear, predictable architecture that serves both SDK users and API consumers.

## 1. Original Concerns

### Current State Issues
- **Mixed Error Patterns**: Inconsistent use of Result<T,C> pattern vs exceptions within the same codebase
- **Code Duplication**: Result utilities duplicated between `src/core/utils/result.ts` and `src/core/schemas/helpers.ts`
- **Unclear Guidelines**: No clear rules for when to use Result vs exceptions, leading to inconsistent implementations
- **API Mapping Confusion**: Inconsistent HTTP status code mapping across endpoints
- **Import Issues**: Resolvers importing from wrong Result implementation causing maintenance issues

### Specific Problems Identified
```typescript
// Current inconsistencies:
public async switchLLM(...): Promise<Result<ValidatedLLMConfig, Context>> // ✅ Good
public async getSessionHistory(id: string) { throw new Error(`Session '${id}' not found`) } // ❓ Inconsistent
public async start(): Promise<void> { throw new Error('Agent already started') } // ❓ Generic errors
```

### Impact
- **Developer Confusion**: Contributors unsure which pattern to use
- **Inconsistent API Experience**: Some endpoints return structured errors, others throw generic errors
- **Maintenance Overhead**: Duplicate Result implementations requiring synchronized updates
- **Type Safety Loss**: Generic Error objects provide no structured information

## 2. Desired Outcomes

### Primary Goals
1. **Predictable Error Semantics**: Clear, consistent patterns for both SDK users and API consumers
2. **Type Safety**: Errors surfaced appropriately in the type system where beneficial
3. **Clear API Semantics**: Unambiguous HTTP status code mapping (200/400/404/500)
4. **Maintainability**: Simple rules that new contributors can memorize and apply
5. **No Over-engineering**: Reasonable boilerplate that doesn't hinder development

### Success Criteria
- Single source of truth for Result implementation
- Clear decision tree for Result vs Exception usage
- Consistent HTTP status code mapping across all API endpoints
- Comprehensive documentation and enforcement guidelines
- Zero breaking changes for internal development (no external users currently)

## 3. Discussion Summary and Tradeoffs

### Multi-Agent Consultation
Consulted with multiple AI agents to evaluate architectural approaches:

#### Options Considered
- **A) Everything as Result**: Compile-time guarantees but noisy plumbing for IO errors
- **B) Current Mixed Approach**: Pragmatic but needs clearer guidelines  
- **C) Everything throws**: Uniform but loses explicit warnings and type safety
- **D) Refined Mixed Approach**: Clear rules with typed errors and Result for domain operations

#### Key Insights
- **Agent 3's Recommendation**: Refined mixed approach with clear decision tree and typed error hierarchy
- **Practical Focus**: Emphasis on implementable patterns over theoretical purity
- **HTTP Mapping**: Structured approach to status code mapping with helper functions
- **Enforcement Strategy**: ESLint rules and contributor guidelines for consistency

#### Tradeoffs Accepted
- **Complexity**: Two error patterns instead of one, but with clear separation of concerns
- **Learning Curve**: Contributors need to understand when to use which pattern
- **Initial Refactoring**: Significant upfront work to standardize existing code
- **Type Annotations**: Explicit return types required for domain methods

## 4. Final Decisions

### Core Architecture Decision
**Adopt Refined Mixed Approach (Option D)** with the following principles:

#### Decision Tree
```
Can the user fix it by changing input/configuration?
├─ Yes → return Result<T, C> (domain/validation errors)
└─ No  → throw SaikiError (infrastructure/invariant errors)

Is it a lifecycle/infrastructure operation?
├─ Yes → throw SaikiError (with appropriate error code)
└─ No  → return Result<T, C> (domain operation)
```

#### Error Pattern Assignment
- **Result<T,C> Pattern**: User input validation, business rule checks, domain operations, schema parsing
- **Exception Pattern**: Agent lifecycle, infrastructure failures, precondition checks, programming errors

#### Implementation Approach
- Start simple with single error class and basic HTTP mapping
- Expand later with subclasses and advanced status codes if needed
- Leverage existing SaikiErrorCode enum (better than class hierarchies)
- Focus on 20% of changes that provide 80% of benefits

## 5. Complete Technical Implementation Plan

### Phase 1: Foundation (Priority: Critical, Timeline: 2-3 days)

#### Task 1.1: Consolidate Result Implementation
**Objective**: Single source of truth for Result pattern

**Actions**:
1. **Remove duplicate Result code from `src/core/schemas/helpers.ts`**
   - Delete Result, Issue, ok, fail, hasErrors, splitIssues, zodToIssues functions
   - Keep only schema-specific utilities (NonEmptyTrimmed, OptionalURL, etc.)

2. **Enhance `src/core/utils/result.ts` with discriminated types**
   ```typescript
   // Improved discriminated union
   type Ok<T, C> = { ok: true; data: T; issues: Issue<C>[] }
   type Err<C>   = { ok: false; issues: Issue<C>[]; data?: never }
   type Result<T, C = unknown> = Ok<T, C> | Err<C>
   ```

3. **Fix all imports across codebase**
   - Update `src/core/llm/resolver.ts`: Change imports from `../schemas/helpers.js` to `../utils/result.js`
   - Update `src/core/mcp/resolver.ts`: Same import fix
   - Verify all other files import from correct location

4. **Re-export from core index**
   ```typescript
   // src/core/index.ts
   export { Result, Issue, ok, fail, hasErrors, splitIssues, zodToIssues } from './utils/result.js';
   ```

**Deliverables**:
- [ ] Single Result implementation in `src/core/utils/result.ts`
- [ ] All imports updated and verified
- [ ] Discriminated Result type implemented
- [ ] Core re-exports added

#### Task 1.2: Create Single Typed Error Class
**Objective**: Replace generic Error objects with structured error types (start simple)

**Actions**:
1. **Create `src/core/errors.ts`**
   ```typescript
   import { SaikiErrorCode } from './schemas/errors.js';

   export class SaikiError extends Error {
     constructor(
       message: string,
       public readonly code: SaikiErrorCode,
       public readonly cause?: unknown
     ) {
       super(message);
       this.name = 'SaikiError';
     }
   }

   // Helper factory functions for common patterns (avoid subclasses for now)
   export function createInfrastructureError(message: string, cause?: unknown): SaikiError {
     return new SaikiError(message, SaikiErrorCode.INFRASTRUCTURE_ERROR, cause);
   }

   export function createIllegalStateError(message: string): SaikiError {
     return new SaikiError(message, SaikiErrorCode.ILLEGAL_STATE_ERROR);
   }
   ```

2. **Add new error codes to `src/core/schemas/errors.ts`**
   ```typescript
   export const enum SaikiErrorCode {
     // ... existing codes ...
     INFRASTRUCTURE_ERROR = 'infrastructure_error',
     ILLEGAL_STATE_ERROR = 'illegal_state_error',
     INTERNAL_BUG = 'internal_bug',
   }
   ```

**Deliverables**:
- [ ] `src/core/errors.ts` created with single SaikiError class
- [ ] Helper factory functions for common patterns
- [ ] New error codes added to enum
- [ ] Error class exported from core index

#### Task 1.3: Create API Helper Functions
**Objective**: Consistent HTTP status code mapping

**Actions**:
1. **Create `src/app/utils/api-helpers.ts`**
   ```typescript
   import type { Response } from 'express';
   import type { Result } from '@core/utils/result.js';
   import { SaikiError } from '@core/errors.js';

   export function sendResult<T, C>(
     res: Response, 
     result: Result<T, C>,
     options?: { onOk?: number; onFail?: number }
   ) {
     if (result.ok) {
       const status = options?.onOk ?? 200;
       return res.status(status).json(result);
     }

     // Determine appropriate error status code
     const hasNotFound = result.issues.some(issue => 
       issue.code.includes('not_found') || issue.code.includes('NOT_FOUND')
     );
     const status = hasNotFound ? 404 : (options?.onFail ?? 400);
     return res.status(status).json(result);
   }

   export function createErrorMiddleware() {
     return (err: unknown, _req: any, res: Response, _next: any) => {
       if (err instanceof SaikiError) {
         const status = getStatusCodeForSaikiError(err.code);
         return res.status(status).json({
           ok: false,
           issues: [{
             code: err.code,
             message: err.message,
             severity: 'error' as const,
             context: err.cause ? { cause: String(err.cause) } : undefined
           }]
         });
       }

       // Generic error fallback
       return res.status(500).json({
         ok: false,
         issues: [{
           code: 'INTERNAL_BUG',
           message: 'Internal server error',
           severity: 'error' as const
         }]
       });
     };
   }

   function getStatusCodeForSaikiError(code: string): number {
     switch (code) {
       case 'ILLEGAL_STATE_ERROR': return 400;
       case 'INFRASTRUCTURE_ERROR': return 503;
       default: return 500;
     }
   }
   ```

**Deliverables**:
- [ ] `sendResult()` helper function created
- [ ] Error middleware created
- [ ] HTTP status code mapping logic implemented

### Phase 2: Method Standardization (Priority: High, Timeline: 3-4 days)

#### Task 2.1: Apply Decision Tree to SaikiAgent Methods
**Objective**: Consistent error handling across all public methods

**Actions**:

1. **Audit all SaikiAgent public methods**
   - Create inventory of current error handling patterns
   - Classify each method using the decision tree
   - Document required changes

2. **Infrastructure Methods (Keep Throwing)**
   ```typescript
   // These are correct as-is:
   public async start(): Promise<void> // throws IllegalStateError
   public async stop(): Promise<void>  // throws SaikiError
   private ensureStarted(): void       // throws IllegalStateError
   ```

3. **Domain Methods (Convert to Result)**
   ```typescript
   // Current: throws Error
   public async getSessionHistory(id: string): Promise<ConversationHistory>

   // New: returns Result
   public async getSessionHistory(id: string): Promise<Result<ConversationHistory, {id: string}>> {
     this.ensureStarted(); // Still throws for preconditions
     
     const session = await this.sessionManager.getSession(id);
     if (!session) {
       return fail([{
         code: SaikiErrorCode.AGENT_SESSION_NOT_FOUND,
         message: `Session '${id}' not found`,
         severity: 'error',
         context: { id }
       }]);
     }
     
     try {
       const history = await session.getHistory();
       return ok(history);
     } catch (error) {
       // Infrastructure errors still throw - use factory function
       throw createInfrastructureError('Failed to retrieve session history', error);
     }
   }
   ```

4. **Update method signatures with explicit return types**
   - All domain methods: `Promise<Result<T, C>>`
   - All infrastructure methods: `Promise<void>` or `Promise<T>` (may throw)

**Deliverables**:
- [ ] Method classification document
- [ ] All domain methods converted to Result pattern
- [ ] All infrastructure methods use typed errors
- [ ] Explicit return types added

#### Task 2.2: Update Internal Error Handling
**Objective**: Ensure internal services properly propagate errors

**Actions**:
1. **Review service layer error handling**
   - SessionManager, MCPManager, etc.
   - Ensure they throw appropriate SaikiError types
   
2. **Add error wrapping where needed**
   ```typescript
   // In service classes
   try {
     await this.database.connect();
   } catch (error) {
     throw createInfrastructureError('Database connection failed', error);
   }
   ```

**Deliverables**:
- [ ] Service layer error handling updated
- [ ] Consistent error wrapping implemented

### Phase 3: API Layer Updates (Priority: Medium, Timeline: 2-3 days)

#### Task 3.1: Update All API Endpoints
**Objective**: Consistent API response patterns

**Actions**:
1. **Apply sendResult() helper to all domain endpoints**
   ```typescript
   // Before
   app.post('/api/llm/switch', express.json(), async (req, res) => {
     const result = await agent.switchLLM(validation.data);
     if (result.ok) {
       return res.status(200).json(result);
     } else {
       return res.status(400).json(result);
     }
   });

   // After
   app.post('/api/llm/switch', express.json(), async (req, res, next) => {
     try {
       const result = await agent.switchLLM(validation.data);
       return sendResult(res, result);
     } catch (error) {
       next(error);
     }
   });
   ```

2. **Add error middleware to Express app**
   ```typescript
   // In server.ts
   import { createErrorMiddleware } from '../utils/api-helpers.js';
   
   app.use(createErrorMiddleware());
   ```

3. **Remove redundant try/catch blocks**
   - Let middleware handle thrown errors
   - Keep only try/catch where business logic requires it

**Deliverables**:
- [ ] All API endpoints updated to use sendResult()
- [ ] Error middleware added to Express app
- [ ] Redundant error handling removed

#### Task 3.2: Update API Response Types
**Objective**: Consistent response structure

**Actions**:
1. **Standardize all API responses to Result format**
2. **Update API documentation to reflect new error format**
3. **Add response type definitions for OpenAPI/Swagger**

**Deliverables**:
- [ ] Consistent response format across all endpoints
- [ ] Updated API documentation
- [ ] Type definitions for API responses

### Phase 4: Documentation and Enforcement (Priority: Low, Timeline: 1-2 days)

#### Task 4.1: Create Contributor Guidelines
**Objective**: Clear rules for consistent implementation

**Actions**:
1. **Create `docs/error-handling-guide.md`**
   - Decision tree diagram
   - Code examples for each pattern
   - Common pitfalls and how to avoid them

2. **Add to existing documentation**
   - Update README with error handling section
   - Add to API documentation

**Content Outline**:
```markdown
# Error Handling Guide

## Decision Tree
Can the user fix it by changing input/configuration?
├─ Yes → return Result<T, C>
└─ No  → throw SaikiError

## Examples
### Domain Operations (Result Pattern)
[Code examples]

### Infrastructure Operations (Exception Pattern)  
[Code examples]

## API Layer Mapping
[HTTP status code mapping examples]

## Common Patterns
[Frequently used patterns and utilities]
```

**Deliverables**:
- [ ] Comprehensive error handling guide
- [ ] Updated existing documentation
- [ ] Code examples for common patterns

#### Task 4.2: Add Enforcement Tools
**Objective**: Prevent regressions and ensure consistency

**Actions**:
1. **ESLint Rules (Future Enhancement)**
   - Rule to prevent `throw new Error()` (require SaikiError)
   - Rule to enforce explicit return types on domain methods
   - Rule to flag Result pattern in infrastructure methods

2. **Test Patterns**
   - Contract tests for Result/Exception patterns
   - API response format tests
   - Error middleware tests

**Deliverables**:
- [ ] ESLint rule configuration (basic)
- [ ] Test patterns for error handling
- [ ] Validation tests for consistency

## 6. Testing Strategy

### Unit Tests
- Test Result helper functions (ok, fail, hasErrors, etc.)
- Test SaikiError class and factory functions
- Test sendResult() helper with various scenarios
- Test error middleware with different error types

### Integration Tests
- Test complete API flows with Result pattern
- Test error propagation from services to API layer
- Test HTTP status code mapping
- Test error middleware integration

### Contract Tests
- Ensure all domain methods return Result<T, C>
- Ensure all infrastructure methods may throw SaikiError
- Ensure API responses match expected format

## 7. Migration Strategy

### Backwards Compatibility
- No external users exist, so breaking changes are acceptable
- Internal APIs can be updated immediately
- Focus on consistency over compatibility

### Rollout Approach
1. **Foundation First**: Implement Result consolidation and error classes
2. **Core Services**: Update SaikiAgent and major services
3. **API Layer**: Update all endpoints to use new patterns
4. **Documentation**: Complete guides and examples
5. **Enforcement**: Add linting and testing rules

### Risk Mitigation
- Comprehensive testing during migration
- Phase-by-phase implementation to catch issues early
- Keep old patterns temporarily during transition
- Document all changes for team awareness

## 8. Future Considerations

### Potential Enhancements
1. **Advanced Error Classes**
   - TimeoutError, ValidationError, ExternalServiceError subclasses
   - Only add if clear patterns emerge in usage

2. **Enhanced HTTP Status Mapping**
   - 502/503/504 for different infrastructure failures
   - More granular 4xx codes for different validation failures
   - Implement based on actual API usage patterns

3. **Monitoring and Observability**
   - Structured error logging with error codes
   - Error rate monitoring by error type
   - Dashboard for error pattern analysis

4. **Advanced Result Patterns**
   - Railway-oriented programming helpers
   - Async Result chainable operations
   - Integration with libraries like neverthrow

5. **Developer Experience**
   - VS Code snippets for common error patterns
   - Live templates for Result/Error patterns
   - Automated refactoring tools

### Expansion Criteria
- **Error Classes**: Add subclasses when you have 3+ similar error scenarios
- **HTTP Mapping**: Add specific status codes when clients need different handling
- **Tooling**: Add advanced tooling when team size grows beyond 3-4 developers

### Success Metrics
- **Consistency Score**: % of methods following correct pattern
- **Error Clarity**: Reduction in "Unknown error" reports
- **Developer Velocity**: Time to implement new endpoints/methods
- **API Usability**: Client feedback on error handling experience

## Implementation Checklist

### Phase 1: Foundation
- [ ] Remove duplicate Result implementation
- [ ] Create discriminated Result types
- [ ] Fix all imports to use single Result source
- [ ] Create single SaikiError class with factory functions
- [ ] Add new error codes to enum
- [ ] Create sendResult() API helper
- [ ] Create error middleware

### Phase 2: Standardization
- [ ] Audit all SaikiAgent methods
- [ ] Convert domain methods to Result pattern
- [ ] Update infrastructure methods to use SaikiError
- [ ] Add explicit return types
- [ ] Update service layer error handling

### Phase 3: API Updates
- [ ] Update all API endpoints to use sendResult()
- [ ] Add error middleware to Express app
- [ ] Remove redundant error handling
- [ ] Standardize API response format

### Phase 4: Documentation
- [ ] Create error handling guide
- [ ] Update existing documentation
- [ ] Add code examples
- [ ] Create basic ESLint rules
- [ ] Add test patterns

### Validation
- [ ] All tests passing
- [ ] No generic Error objects in public APIs
- [ ] All API endpoints return consistent format
- [ ] Documentation complete and accurate
- [ ] Team understands new patterns

---

**Document Version**: 1.0  
**Created**: January 2025  
**Last Updated**: January 2025  
**Status**: Ready for Implementation
