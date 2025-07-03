# Saiki Development Guidelines for AI Assistants

## Code Quality Requirements

**Pre-commit Validation** - Before completing any task, ALWAYS run and ensure ALL commands pass:
1. `npm run build` - Verify compilation
2. `npm test` - Ensure all tests pass  
3. `npm run lint` - Check code style
4. `npm run typecheck` - Validate TypeScript types

## Testing Strategy

### Test Classification
- **Unit Tests**: `*.test.ts` - Fast tests with mocked dependencies, isolated component testing
- **Integration Tests**: `*.integration.test.ts` - Real dependencies, cross-component testing
- **Future**: `*.e2e.test.ts` - Full system end-to-end testing

### Test Commands
- `npm test` - Run all tests (unit + integration)
- `npm run test:unit` - Run only unit tests (fast, for development)
- `npm run test:integ` - Run only integration tests (thorough, for CI/releases)
- `npm run test:unit:watch` - Watch mode for unit tests during development
- `npm run test:integ:watch` - Watch mode for integration tests

### Testing Guidelines
- **Development workflow**: Run unit tests frequently for fast feedback
- **Pre-commit**: Run integration tests to ensure cross-component compatibility
- **CI/CD**: Use unit tests for PR checks, full test suite for releases
- **Follow existing test patterns** - Check README and search codebase for test framework
- **Verify before marking complete** - All quality checks must pass
- **Add regression tests** - When fixing bugs, add tests to prevent recurrence
- **Ensure tests pass before fixing lint/typescript errors** - Always ensure tests pass before fixing ts/lint issues

[Rest of the file remains unchanged...]