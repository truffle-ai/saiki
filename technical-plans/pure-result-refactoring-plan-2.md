# Pure Result<T,C> Refactoring Plan - Complete Nuclear Option

## **Status: Phase 1 Complete, Phase 2 In Progress (40%)**

## **Overview**
Complete elimination of ALL legacy validation patterns in favor of a single, consistent `Result<T,C>` pattern across 100% of the codebase. Zero backward compatibility - pure nuclear option.

---

## **DOMAIN-SPECIFIC ERROR CODES (Mandatory)**

### **LLM Domain Codes:**
```typescript
const LLM_ERROR_CODES = {
  MISSING_API_KEY: 'missing_api_key',
  INVALID_MODEL: 'invalid_model', 
  INCOMPATIBLE_MODEL_PROVIDER: 'incompatible_model_provider',
  UNSUPPORTED_ROUTER: 'unsupported_router',
  INVALID_BASE_URL: 'invalid_base_url',
  INVALID_MAX_TOKENS: 'invalid_max_tokens',
  SCHEMA_VALIDATION: 'schema_validation',
  SHORT_API_KEY: 'short_api_key'
} as const;
```

### **Input Validation Codes:**
```typescript
const INPUT_ERROR_CODES = {
  FILE_TOO_LARGE: 'file_too_large',
  UNSUPPORTED_FILE_TYPE: 'unsupported_file_type',
  INVALID_FILE_FORMAT: 'invalid_file_format',
  IMAGE_TOO_LARGE: 'image_too_large',
  UNSUPPORTED_IMAGE_TYPE: 'unsupported_image_type'
} as const;
```

### **MCP Domain Codes:**
```typescript
const MCP_ERROR_CODES = {
  INVALID_SERVER_CONFIG: 'invalid_server_config',
  DUPLICATE_SERVER_NAME: 'duplicate_server_name',
  CONNECTION_FAILED: 'connection_failed',
  INVALID_SERVER_NAME: 'invalid_server_name',
  INVALID_URL_FORMAT: 'invalid_url_format',
  EMPTY_COMMAND: 'empty_command'
} as const;
```

---

## **CONTEXT TYPE DEFINITIONS (Required)**

### **LLM Context:**
```typescript
export type LLMConfigContext = {
  provider?: string;
  model?: string;
  router?: string;
  suggestedAction?: string;
};
```

### **Input Validation Context:**
```typescript
export type InputValidationContext = {
  provider?: string;
  model?: string;
  fileSize?: number;
  maxFileSize?: number;
  filename?: string;
  mimeType?: string;
  fileType?: string;
  suggestedAction?: string;
};
```

### **MCP Server Context:**
```typescript
export type McpServerContext = {
  serverName?: string;
  serverType?: string;
  url?: string;
  command?: string;
  suggestedAction?: string;
};
```

---

## **PHASE 1: Core Primitives ✅ COMPLETE**

- [x] **`src/core/utils/result.ts`** - Generic Result<T,C> implementation
- [x] **`src/core/utils/index.ts`** - Export Result utilities
- [x] **Enhanced `fromZod` function** - Map Zod errors to domain-specific codes

---

## **PHASE 2: Core Validation Functions - 40% COMPLETE**

### **✅ COMPLETED:**

**File: `src/core/config/validation-utils.ts`**
- [x] `buildLLMConfig()` returns `Result<ValidatedLLMConfig, LLMConfigContext>`
- [x] `validateMcpServerConfig()` returns `Result<ValidatedMcpServerConfig, McpServerContext>`
- [x] Uses `zodResult()` helper consistently

**File: `src/core/config/agent-state-manager.ts`**
- [x] `updateLLM()` returns `Result<void, LLMConfigContext>`
- [x] `addMcpServer()` returns `Result<ValidatedMcpServerConfig, McpServerContext>`
- [x] All methods use `.ok` instead of `.isValid`

### **🔄 IN PROGRESS:**

**File: `src/core/config/validation-utils.ts`**
- [ ] **MANDATORY: Add short API key warning logic**
  ```typescript
  // Add to buildLLMConfig around line 118:
  if (finalApiKey && finalApiKey.length < 10) {
    warnings.push({
      code: LLM_ERROR_CODES.SHORT_API_KEY,
      message: 'API key seems too short - please verify it is correct',
      severity: 'warning',
      context: { provider: finalProvider }
    });
  }
  ```

**File: `src/core/utils/result.ts`**
- [ ] **MANDATORY: Enhanced fromZod mapping**
  ```typescript
  export function fromZod<C = unknown>(error: ZodError, ctx?: Partial<C>): Result<never, C> {
    const issues: Issue<C>[] = error.errors.map((z) => {
      let code = 'schema_validation'; // default
      
      // Pattern matching for specific error types
      if (z.message.includes('is not supported for provider')) {
        code = 'incompatible_model_provider';
      } else if (z.message.includes('does not support') && z.message.includes('router')) {
        code = 'unsupported_router';
      } else if (z.message.includes('does not support baseURL')) {
        code = 'invalid_base_url';
      } else if (z.path.includes('maxInputTokens') && z.message.includes('positive')) {
        code = 'invalid_max_tokens';
      }
      // ... more patterns
      
      return {
        code,
        message: z.message,
        path: z.path.join('.'),
        severity: 'error' as const,
        context: ctx as C,
      };
    });
    return fail(issues);
  }
  ```

### **🔄 TO COMPLETE - PHASE 2:**

**File: `src/core/llm/validation.ts` - COMPLETE REWRITE REQUIRED**

**CURRENT PROBLEMS:**
- Lines 30-202: Uses legacy `InputValidationResult` interface
- Line 183-200: `createInputValidationError()` returns old format
- Mixed Result<T,C> and legacy patterns

**REQUIRED CHANGES:**
```typescript
// REPLACE: InputValidationResult interface (lines 30-50)
// WITH: Pure Result<ValidationData, InputValidationContext>

// REPLACE: validateInputForLLM function (lines 51-120)
export function validateInputForLLM(
  imageData?: ImageData,
  fileData?: FileData,
  config: ValidationLLMConfig = { provider: 'openai' }
): Result<ValidationData, InputValidationContext> {
  const issues: Issue<InputValidationContext>[] = [];
  const validationData: ValidationData = {};

  // Image validation
  if (imageData) {
    if (imageData.size > MAX_IMAGE_SIZE) {
      issues.push({
        code: INPUT_ERROR_CODES.IMAGE_TOO_LARGE,
        message: `Image size ${imageData.size} exceeds maximum ${MAX_IMAGE_SIZE}`,
        severity: 'error',
        context: {
          provider: config.provider,
          model: config.model,
          fileSize: imageData.size,
          maxFileSize: MAX_IMAGE_SIZE,
          suggestedAction: 'Reduce image size or use a different image'
        }
      });
    }
    validationData.imageValidation = { isSupported: issues.length === 0 };
  }

  // File validation
  if (fileData) {
    const fileValidation = validateModelFileSupport(config.provider, config.model || '', fileData.mimeType);
    if (!fileValidation.isSupported) {
      issues.push({
        code: INPUT_ERROR_CODES.UNSUPPORTED_FILE_TYPE,
        message: fileValidation.error || `File type not supported`,
        severity: 'error',
        context: {
          provider: config.provider,
          model: config.model,
          mimeType: fileData.mimeType,
          fileType: fileValidation.fileType,
          suggestedAction: 'Use a supported file type or different model'
        }
      });
    }
    validationData.fileValidation = fileValidation;
  }

  return issues.length > 0 ? fail(issues) : ok(validationData);
}

// DELETE: createInputValidationError function (lines 183-200)
// REASON: No longer needed with pure Result<T,C> pattern
```

---

## **PHASE 3: Consumer Updates - 0% COMPLETE**

### **Core Production Files:**

**File: `src/core/agent/SaikiAgent.ts` - Lines 648-677**
- [ ] **Update switchLLM method error handling**
  ```typescript
  // CURRENT (lines 655-671): Manual error mapping
  errors: result.issues.filter((i) => i.severity !== 'warning').map((err) => ({
    type: err.code,
    message: err.message,
    ...(err.context?.provider && { provider: err.context.provider }),
    // ... manual field extraction
  }))

  // REPLACE WITH: Direct passthrough
  errors: result.issues.filter(i => i.severity !== 'warning')
  ```

**File: `src/core/session/chat-session.ts`**
- [ ] **Find and update all validation checks**
  - Search: `if (validation.isValid)` → `if (validation.ok)`
  - Search: `validation.errors` → `validation.issues`

**File: `src/core/session/session-manager.ts`**
- [ ] **Find and update LLM switching validation**
  - Search: `.isValid` → `.ok`
  - Search: `.errors` → `.issues`

### **CLI and API Layer:**

**File: `src/app/cli/interactive-commands/mcp/mcp-add-utils.ts`**
- [ ] **Update MCP server validation handling**
  - Search: `validation.isValid` → `validation.ok`
  - Search: `validation.errors` → `validation.issues`

**File: `src/app/api/server.ts`**
- [ ] **Replace manual safeParse with zodResult**
  ```typescript
  // FIND: schema.safeParse(data)
  // REPLACE: zodResult(schema, data, context)
  ```

---

## **PHASE 4: Test Migration - 30% COMPLETE**

### **✅ COMPLETED:**
- [x] **`src/core/config/validation-utils.test.ts`** - All tests updated to Result<T,C>

### **🔄 CRITICAL - MUST COMPLETE:**

**File: `src/core/llm/validation.test.ts` - Lines 12-80+**
- [ ] **Update 20+ test assertions**
  ```typescript
  // FIND ALL: expect(result.isValid).toBe(true)
  // REPLACE: expect(result.ok).toBe(true)
  
  // FIND ALL: expect(result.errors).toHaveLength(0)
  // REPLACE: expect(result.issues.filter(i => i.severity !== 'warning')).toHaveLength(0)
  
  // FIND ALL: expect(result.errors?.[0]?.message)
  // REPLACE: expect(result.issues[0]?.message)
  
  // ADD: expect(result.issues[0]?.code).toBe('specific_error_code')
  // ADD: expect(result.issues[0]?.context?.provider).toBe('openai')
  ```

**File: `src/core/config/schemas.test.ts`**
- [ ] **Replace direct .parse() calls with zodResult**
  ```typescript
  // FIND: ContributorConfigSchema.parse(config)
  // REPLACE: zodResult(ContributorConfigSchema, config)
  ```

---

## **PHASE 5: Cleanup and Validation - 0% COMPLETE**

### **Delete Legacy Code:**
- [ ] **Remove unused interfaces** (after all consumers updated):
  ```typescript
  // DELETE from validation files:
  interface ValidationResult { isValid: boolean; errors: any[]; warnings: string[] }
  interface InputValidationResult extends ValidationResult
  function createInputValidationError() // in validation.ts:183-200
  ```

### **Verification Steps:**
- [ ] **Run full build**: `npm run build` - Must pass with 0 TypeScript errors
- [ ] **Run all tests**: `npm test` - Must pass 100%
- [ ] **Run type check**: `npm run typecheck` - Must pass
- [ ] **Run linter**: `npm run lint` - Must pass

### **Codebase Audit:**
- [ ] **Search for remaining legacy patterns**:
  ```bash
  grep -r "isValid\|ValidationResult\|\.success\|\.errors" src/ --include="*.ts"
  # Should return 0 results (except for test descriptions)
  ```

---

## **CURRENT FAILING TESTS - IMMEDIATE FIX REQUIRED**

### **File: `validation-utils.test.ts`**
**Problem**: Tests expect specific codes like `'invalid_max_tokens'` but get generic `'schema'`

**Solution**: Enhanced `fromZod` mapping (see Phase 2 above)

**Failing Test Cases:**
1. Line 108: expects `'missing_api_key'` code
2. Line 139: expects `'schema_validation'` code  
3. Line 155: expects short API key warning message
4. Line 189: expects `'invalid_base_url'` code
5. Line 213: expects `'invalid_max_tokens'` code
6. Line 221: expects `'unsupported_router'` code

---

## **EXECUTION CHECKLIST - NEXT IMMEDIATE ACTIONS**

### **Step 1: Fix Current Test Failures (1-2 hours)**
- [ ] Add short API key warning to `buildLLMConfig` (validation-utils.ts:118)
- [ ] Enhance `fromZod` function with domain-specific error code mapping
- [ ] Run tests: `npm test -- validation-utils.test.ts` - Must pass 100%

### **Step 2: Complete Phase 2 Core Functions (2-3 hours)**
- [ ] Rewrite `src/core/llm/validation.ts` validateInputForLLM function
- [ ] Delete `createInputValidationError` function
- [ ] Update all consumers of `validateInputForLLM`

### **Step 3: Update Core Production Code (2-4 hours)**
- [ ] Fix `SaikiAgent.ts` error handling (remove manual mapping)
- [ ] Update session management files
- [ ] Update CLI utilities

### **Step 4: Complete Test Migration (1-2 hours)**
- [ ] Fix `src/core/llm/validation.test.ts` assertions
- [ ] Update schema tests
- [ ] Run full test suite

### **Step 5: Final Validation**
- [ ] Build, test, lint, typecheck - all must pass
- [ ] Audit search for legacy patterns - must return 0 results
- [ ] Verify all functions return `Result<T,C>` pattern

---

## **SUCCESS CRITERIA**

### **Code Quality:**
- ✅ Single `Result<T,C>` pattern across 100% of validation code
- ✅ Domain-specific error codes with rich context
- ✅ Zero legacy interfaces remaining
- ✅ Zero manual error transformation code

### **Test Quality:**
- ✅ All tests use consistent `result.ok` / `result.issues` assertions
- ✅ Tests verify error codes and context fields
- ✅ 100% test pass rate

### **Type Safety:**
- ✅ Strong typing for all context objects
- ✅ TypeScript knows exact fields available in error context
- ✅ Zero `any` types in validation code

### **Developer Experience:**
- ✅ Single pattern to learn across entire codebase
- ✅ Consistent error handling in all domains
- ✅ Rich, actionable error messages with context

---

## **ESTIMATED COMPLETION TIME: 8-10 hours**

This plan provides zero ambiguity and complete coverage of the Pure Result<T,C> transformation. Every file, every function, every test case is explicitly identified with exact changes required.