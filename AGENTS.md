# Agent Guidelines for xno-skills

## Build & Test

- `npm test` **builds ESM first** then runs vitest. The test step depends on the build output.
- `npm run build` produces ESM only (`dist/esm`). `npm run build:cjs` produces CJS (`dist/cjs`). `prepack` runs both.
- `npm run dev` runs the CLI via `tsx` (no build needed): `npm run dev -- <subcommand>`.
- Run a single test file: `npx vitest run test/<name>.test.ts`.
- `src/version.ts` is **auto-generated** from `package.json` by `scripts/update-version.js`. Never edit it by hand; the `prebuild` hook keeps it in sync.

## ESM Import Requirement

- All relative imports **MUST** include the `.js` extension (e.g., `import { foo } from './foo.js';`). The ESM build will break without it.

## OWS Key Custody

- All key management delegates to [OWS](https://github.com/open-wallet-standard). Agents **never** handle seeds or mnemonics directly.
- `send`, `receive`, `change-rep`, `submit-block` trigger OWS signing internally. `block ...` CLI subcommands remain **unsigned** construction helpers only.
- OWS wallets only support account index 0. Attempting `index > 0` throws.
- Mock mode: set `XNO_MCP_MOCK_OWS=true` to use a fake wallet (useful for tests/local dev without real keys).

## MCP Server

### Spending Limit
- `send` and `payment_request_refund` are gated by `maxSendXno` (default `1.0` XNO). Override via `config_set` or `XNO_MAX_SEND` env var.

### Persistence
State lives in `${XNO_MCP_HOME}` (default: `<install-dir>/.xno-mcp`).
- `config.json`: RPC URLs and app settings.
- `requests.json`: Tracked payment requests.
- `transactions.json`: Local transaction ledger.
- OWS wallets themselves are stored in `~/.ows`, separate from xno-skills state.

### MCP Tool Patterns
- Tool arguments are untyped in the SDK. Cast explicitly: `String((args as any)?.name)`.
- Wrap responses: `{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }`.
- In tests, access response text via: `(result.content[0] as any).text`.

### MCP Resource Patterns
- `name` must be a **short logical identifier** (e.g. wallet name `"A"`), never a URI or concatenated fields. `title` is for human-readable display. Embedding `xno-wallet://` URIs in `name` causes hosts to crash when LLMs propagate them as fetchable links.
- Resource templates use the same `name`/`title` split: `name` is a slug like `"wallet-status"`, `title` is display text.
- No resource tests exist yet — `listResources()`, `listResourceTemplates()`, and `readResource()` are untested.

### Hidden / WIP Tools
- `sign_message` and `verify_message` MCP tools are commented out (waiting on NOMS PR merge into OWS core: https://github.com/open-wallet-standard/core/pull/217).
- `sign-message` and `verify-message` CLI subcommands are `{ hidden: true }` and pending the same upstream PR — do not expose or document them.
- The public `sign` and `verify` CLI subcommands (raw private-key path) are visible and fully functional — distinct from the hidden OWS-backed variants above.
- `wallet_list`, `wallet_balance`, `wallet_receive`, `wallet_send` are deprecated aliases in the MCP server.

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `XNO_MCP_HOME` | Home directory for config/state | `<installed-dir>/.xno-mcp` |
| `XNO_MAX_SEND` | Max send per transaction (XNO) | `1.0` |
| `NANO_RPC_URL` | Override primary Nano node RPC URL | Public nodes |
| `XNO_WORK_URL` | Override remote PoW URL | Automatic probing |
| `XNO_MCP_MOCK_OWS` | Use mock OWS wallet for dev/test | `false` |
| `XNO_MCP_CONFIG_PATH` | Override config.json path | `$XNO_MCP_HOME/config.json` |
| `XNO_MCP_REQUESTS_PATH` | Override requests.json path | `$XNO_MCP_HOME/requests.json` |
| `XNO_MCP_TRANSACTIONS_PATH` | Override transactions.json path | `$XNO_MCP_HOME/transactions.json` |

## Architecture

- Single package (not a monorepo). Source in `src/`, tests in `test/`.
- Dual ESM/CJS output via separate tsconfig files (`tsconfig.esm.json`, `tsconfig.cjs.json`).
- Entry points: `src/cli.ts` (CLI), `src/mcp.ts` (MCP server), `src/index.ts` (library exports).
- `src/nano-actions.ts` contains the shared business logic used by both CLI and MCP.
- `src/ows.ts` wraps `@open-wallet-standard/core` with mock-mode support.
- `src/state-store.ts` handles JSON file persistence (config, requests, transactions).
- CLI uses `commander`. MCP uses `@modelcontextprotocol/sdk`.
- `bin/xno-skills` and `bin/xno-mcp` are the npm bin entry points.

## Documentation Sync

After modifying CLI subcommands in `src/cli.ts`, verify the README CLI table against `npm run dev -- --help`. Every subcommand listed in the README must exist, have correct flags, and have no stale entries for removed commands.

The agent skill lives in `skills/nano/SKILL.md` — one unified skill covering all Nano capabilities. Do not re-fragment it into per-capability files.

## Releasing

1. `npm version patch|minor|major` (runs tests, syncs `src/version.ts`).
2. `git push --follow-tags`.
3. GitHub Actions builds, tests, and publishes to npm with provenance (Trusted Publishing via OIDC).
