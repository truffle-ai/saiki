# Test Claude Code Review Workflow

This is a test file to verify that the Claude Code review workflow is working properly with external forks.

## Changes Made
- Switched from `pull_request` to `pull_request_target` 
- Added proper write permissions
- Added manual workflow dispatch option

## Expected Behavior
When this PR is created, Claude should automatically review it and post feedback.

## Test Code
```typescript
// This is a simple function that could use some improvement
function add(a, b) {
    return a + b;
}

// Missing error handling
function divide(x, y) {
    return x / y;
}
```

The code above has some issues that Claude should catch:
1. Missing TypeScript types
2. No error handling for division by zero
3. Could benefit from JSDoc comments