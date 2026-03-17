# Agent Guidelines for xno-skills

This file provides guidelines for agents operating in the xno-skills repository.

## Build, Test, and Development Commands

### Building the Project

```bash
npm run build          # Build both ESM and CJS
npm run build:esm      # Build ESM only
npm run build:cjs      # Build CJS only
```

### Running Tests

```bash
npm test               # Run all tests (builds ESM first)
npm run test:watch     # Run tests in watch mode
```

**Running a single test file:**

```bash
npm test -- test/rpc.test.ts
npm test -- test/mcp.test.ts
```

### Version Bumping

```bash
npm version patch      # Bump patch (e.g., 0.7.2 -> 0.7.3)
npm version minor      # Bump minor
npm version major      # Bump major
```

This runs tests, builds, commits version changes, and creates a git tag. See `RELEASING.md` for full release process.

---

## Project Overview

- **Type**: Node.js CLI + MCP server for Nano (XNO) cryptocurrency
- **Language**: TypeScript (ES2022, strict mode)
- **Testing**: Vitest
- **Module System**: Dual ESM + CJS exports
- **Key Dependencies**: `@modelcontextprotocol/sdk`, `@noble/curves`, `@noble/hashes`, `@scure/bip39`, `commander`, `micro-key-producer`, `nano-pow-with-fallback`, `qrcode-terminal`

---

## Code Style Guidelines

### TypeScript Configuration

The project uses `strict: true` in tsconfig.json. All code must pass strict type checking.

### Imports and Exports

- Use ES module syntax (`import`/`export`)
- Include `.js` extension for relative imports: `import { foo } from './foo.js';`
- Order imports: external libs first, then internal modules
- Use named exports for functions/types, default only for main entry points

### Naming Conventions

- **Files**: kebab-case (`rpc-calls.ts`, `state-block.ts`)
- **Interfaces/Types**: PascalCase (`AccountBalanceResponse`)
- **Functions**: camelCase (`nanoRpcCall`)
- **Constants**: SCREAMING_SNAKE_CASE for compile-time, camelCase for runtime
- **Enums**: PascalCase, members also PascalCase

### Error Handling

- Throw `Error` with descriptive messages, never strings
- Use error prefixes: `throw new Error('RPC error: ...')`
- Catch and rethrow with context
- Avoid generic `any` — use `unknown` and narrow appropriately

### Types and Type Safety

- Always declare return types for exported functions
- Use interfaces for object shapes, type aliases for unions/primitives
- Prefer `unknown` over `any`, then narrow with type guards

### Async/Await

- Use `async`/`await` over raw promises
- Never leave promises floating — always `await` or attach `.then()/.catch()`

### Formatting

- Indentation: 2 spaces
- Semicolons required (all source files use them)
- Trailing commas in multi-line objects/arrays
- Maximum line length: ~100 characters

### Comments

- Use JSDoc for exported functions
- **NEVER add comments unless explicitly requested** (project convention)

### Testing (Vitest)

- Use `describe`/`it` blocks with `expect` matchers
- Mock external dependencies with `vi.mock()`
- Include descriptive test names
- MCP integration tests spin up a real server via `StdioClientTransport` pointing at `bin/xno-mcp`
- Access MCP response text with `(result.content[0] as any).text`

---

## MCP Server Patterns

### Argument Access

MCP tool arguments are untyped. Use the `(args as any)?.field` pattern with explicit casts:

```typescript
const walletName = String((args as any)?.name || "").trim();
const index = Math.max(0, (args as any)?.index ?? 0);
const rpcUrl = (args as any)?.rpcUrl as string | undefined;
const includeXno = (args as any)?.includeXno ?? true;
```

### Return Pattern

All MCP tool handlers return:

```typescript
return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
```

### Spending Limit

`enforceMaxSend(amountRaw)` checks every `wallet_send` and `payment_request_refund`. The limit is a single `maxSendXno` field on `McpConfig`, defaulting to `"1.0"` XNO, settable via `config_set` or `XNO_MAX_SEND` env var. No windowing, no destination whitelists — just a simple per-transaction cap.

### Auto-Receive Before Send

`autoReceivePending()` is called by `wallet_send` when balance is insufficient. It attempts to receive pending blocks before failing.

### Transaction Ledger

All `wallet_send` and `wallet_receive` operations log `TransactionRecord` entries to `transactions.json`. The `wallet_history` tool queries this ledger.

### Payment Request System

Types: `PaymentRequest`, `TransactionRecord`, `PaymentRequestStatus` (`pending | partial | funded | received | refunded | cancelled`).

Tools: `payment_request_create`, `payment_request_status`, `payment_request_receive`, `payment_request_list`, `payment_request_refund`, `wallet_history`.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `XNO_MCP_HOME` | Home directory for config and wallets | `<installed-dir>/.xno-mcp` |
| `XNO_MCP_CONFIG_PATH` | Exact path for `config.json` (overrides HOME) | — |
| `XNO_MCP_PURSES_PATH` | Exact path for `wallets.json` (overrides HOME) | — |
| `XNO_MCP_PERSIST_WALLETS` | `true`/`false` — enable/disable wallet persistence | `true` |
| `XNO_MAX_SEND` | Max send per transaction in XNO | `1.0` |
| `NANO_RPC_URL` | Fallback RPC URL | — |

---

## Git Workflow and Releases

### Before Pushing

1. Run `npm test` — all tests must pass
2. Review `README.md` for correctness
3. If version was bumped, re-review README for new CLI flags/env vars
4. Commit with descriptive message

### Release Process

1. Bump version: `npm version patch`
2. Push with tags: `git push --follow-tags`
3. GitHub Actions publishes to npm and creates GitHub Release

## Important Notes

### Security

- Never log or expose secrets/mnemonics/seeds
- `wallet_create` is the safe custodial API (secrets stay in xno-mcp)
- `generate_wallet` returns secrets in the response — only use for offline key generation
- Use `XNO_MCP_PERSIST_WALLETS=false` for memory-only mode

### MCP Server Persistence

- Wallet persistence enabled by default (override with `XNO_MCP_PERSIST_WALLETS=false`)
- Stored in `{XNO_MCP_HOME}/wallets.json` (default: `<installed-dir>/.xno-mcp/wallets.json`)
- Payment requests: `{XNO_MCP_HOME}/payment-requests.json`
- Transaction ledger: `{XNO_MCP_HOME}/transactions.json`

### RPC and Basic Auth

- Use native Node.js `https` module (not axios or fetch with credentials in URL)
- Pass credentials via URL: `https://username:password@rpc.example.com/`


