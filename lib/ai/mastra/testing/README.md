# MCP Testing Architecture

This directory contains spec-based tests for the MCP (Model Context Protocol) infrastructure with no real server dependencies.

## Architecture Overview

The testing framework has a layered architecture:

### 1. Test Implementation Layer (`*Test.ts` files)
- **`mcpProtocolTest.ts`** - MCP protocol testing framework with `MockMCPServer` class
- **`fluidComputeTest.ts`** - Fluid Compute scenario testing framework

These files contain the test implementation logic and helper classes that simulate MCP behavior.

### 2. Vitest Test Layer (`*.test.ts` files)
- **`mcpProtocol.test.ts`** - Vitest tests for MCP protocol compliance
- **`fluidCompute.test.ts`** - Vitest tests for Fluid Compute scenarios
- **`integration.test.ts`** - Integration tests that use both frameworks

These are the actual test files that Vitest runs.

### 3. Mock Dependencies (`__mocks__/`)
- **`mockDependencies.ts`** - Mock implementations for database and cache to avoid external dependencies

## Why This Architecture?

1. **Reusable Test Infrastructure**: The `MockMCPServer` class in `mcpProtocolTest.ts` is used by multiple test files
2. **Separation of Concerns**: Test implementation logic is separate from test assertions
3. **No Real Dependencies**: All tests use mocks, making them fast and reliable
4. **Spec-Based Testing**: Tests follow MCP specification patterns

## Running Tests

```bash
# Run all tests
pnpm test

# Run specific test pattern
pnpm test:mcp

# Run with coverage
pnpm test:coverage
```

## Test Coverage

- **MCP Protocol Compliance**: Tests initialization, error handling, optional ping, tool execution
- **Fluid Compute Scenarios**: Tests cache resilience, cold start performance, concurrent requests, memory management
- **Integration Tests**: Tests how components work together

## Future Improvements

While the current architecture works well, a potential future refactor could:
- Merge test implementation files directly into Vitest test files where they're only used once
- Extract shared utilities (like `MockMCPServer`) into a separate test utilities file
- Further simplify the layered approach

For now, the architecture provides good test coverage and maintainability.