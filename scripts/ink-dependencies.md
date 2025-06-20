# Ink CLI Dependencies & Setup

## Required NPM Dependencies

Add these to your `package.json`:

```json
{
  "dependencies": {
    "ink": "^4.4.1",
    "react": "^18.2.0",
    "ink-text-input": "^5.0.1",
    "ink-select-input": "^5.0.0",
    "ink-spinner": "^5.0.0",
    "ink-box": "^3.0.0",
    "ink-divider": "^3.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.45",
    "ink-testing-library": "^3.0.0"
  }
}
```

## Installation Command

```bash
npm install ink react ink-text-input ink-select-input ink-spinner ink-box ink-divider
npm install --save-dev @types/react ink-testing-library
```

## Integration into Existing CLI

To integrate the new Ink CLI alongside the existing readline CLI, modify your main CLI entry point:

### 1. Update CLI Entry Point

In `src/app/index.ts`, add a new CLI option:

```typescript
program
  .option('--ui <ui>', 'CLI interface type (readline|ink)', 'readline')
```

### 2. Conditional CLI Start

```typescript
// In the main action handler
switch (opts.mode) {
  case 'cli':
    if (opts.ui === 'ink') {
      if (headlessInput) {
        await startHeadlessInkCli(agent, headlessInput);
      } else {
        await startInkCli(agent);
      }
    } else {
      // Existing readline CLI
      if (headlessInput) {
        await startHeadlessCli(agent, headlessInput);
      } else {
        await startAiCli(agent);
      }
    }
    break;
}
```

### 3. Import the New CLI Functions

```typescript
import { startInkCli, startHeadlessInkCli } from './cli/ink-cli.js';
```

## Testing the New CLI

Once dependencies are installed and integration is complete:

```bash
# Test the new Ink CLI
saiki --ui=ink

# Test headless mode with Ink
saiki --ui=ink "What is TypeScript?"

# Continue using the old CLI (default)
saiki
```

## Migration Strategy

1. **Phase 1**: Install dependencies and test basic functionality
2. **Phase 2**: Add `--ui=ink` flag for parallel testing
3. **Phase 3**: Collect user feedback and improve components
4. **Phase 4**: Make Ink the default CLI
5. **Phase 5**: Deprecate and remove old readline CLI

## Benefits Over Current Implementation

### Current Pain Points Solved:
- ❌ Manual ANSI escape codes → ✅ Automatic layout management
- ❌ Fragile cursor positioning → ✅ Component-based rendering
- ❌ Complex state synchronization → ✅ React state management
- ❌ Limited interactivity → ✅ Rich keyboard shortcuts
- ❌ Terminal resize issues → ✅ Responsive layouts

### New Capabilities:
- Real-time connection status display
- Better visual feedback for streaming responses
- Improved tool confirmation interface
- Message history with proper scrolling
- Contextual help system
- Professional terminal UI appearance

## File Structure

```
src/app/cli/
├── cli.ts                      # Original readline CLI (legacy)
├── ink-cli.tsx                 # New Ink CLI entry point
├── components/
│   ├── SaikiApp.tsx           # Main app component
│   ├── Header.tsx             # Status header
│   ├── ChatArea.tsx           # Message display
│   ├── InputArea.tsx          # User input
│   └── HelpModal.tsx          # Help overlay
├── hooks/
│   ├── useAgentEvents.ts      # Event subscription
│   └── useMessages.ts         # Message management
└── cli-subscriber.ts          # Original event handler (legacy)
```

This structure allows for a gradual migration while maintaining backward compatibility. 