# Utils

> **[AGENTS - READ THIS DOCUMENT AND KEEP IT UP TO DATE, EVALUATE INCONSISTENCIES AND FLAG THEM]**

General-purpose utility functions shared across Saiki's core modules.

## Purpose

This module contains utility functions that are:
- **Cross-module**: Used by multiple core modules
- **Pure functions**: No side effects, predictable outputs
- **Domain-agnostic**: Not specific to any particular business logic

## Current Utilities

The list of helper files evolves frequently. Run `ls src/core/utils/` or open the directory’s README headers for an up-to-date inventory.

## When to Add Code Here

Add utilities to this module when they are:

1. **Reusable**: Used by 2+ core modules
2. **Generic**: Not tied to specific business logic
3. **Stateless**: No internal state or side effects
4. **Well-tested**: Include comprehensive tests

## When NOT to Add Code Here

Don't add code here if it's:

- **Module-specific**: Only used within one core module (keep it there)
- **Business logic**: Contains domain-specific rules or workflows
- **Stateful**: Maintains internal state or has side effects
- **Experimental**: Unproven utility that might change frequently

## Usage Pattern

```typescript
// Import specific utilities
import { convertZodSchemaToJsonSchema } from '../utils/schema.js';
import { resolveApiKey } from '../utils/api-key-resolver.js';

// Use in your module
const jsonSchema = convertZodSchemaToJsonSchema(zodSchema);
const apiKey = resolveApiKey(process.env.API_KEY);
```

Keep utilities focused, tested, and well-documented.

## Related Modules

- All core modules utilize utilities