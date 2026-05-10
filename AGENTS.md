# Agent Guidelines for xno-skills

## Build & Test

- **Package manager authority: this repository uses `npm`.** Source of truth: `package-lock.json`, `package.json` scripts, and the release flow. Prefer `npm` for install, test, build, versioning, and publishing-related commands.
- If a user prompt mentions a different package manager (`bun`, `pnpm`, etc.), **call out the mismatch and still use `npm` by default** unless the user explicitly asks to migrate the repository.
- Apply this rule in reverse too: in any repository, the checked-in lockfile and scripts win over the wording in the prompt. If the repo is on `bun`, prefer `bun`; if it is on `pnpm`, prefer `pnpm`; if it is on `npm`, prefer `npm`.
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

### Cache
- `pow-plan.json` is stored in the **user cache dir**, not `XNO_MCP_HOME`:
  - macOS: `~/Library/Caches/xno-mcp/pow-plan.json`
  - Linux: `$XDG_CACHE_HOME/xno-mcp/pow-plan.json` (fallback: `~/.cache/xno-mcp/pow-plan.json`)
- Override with `XNO_MCP_CACHE_DIR`. Today this file is diagnostic only; deleting it does not change startup behavior unless a future restore path is added.

### PoW / WorkProvider
- `WorkProvider.auto()` defaults to **remote-first** execution order without `profiler: { mode: 'auto' }`. Both `mcp.ts` and `cli.ts` now pass this option — do not remove it. Without it, the system tries the public RPC node before WASM, which is slow and unreliable.
- The probe runs real WASM PoW on first `generate()` call (5–15 s is normal) and builds a local-first plan for that process.
- Do not add eager startup `workProvider.probe()` calls unless there is a measured need and a regression test covering MCP transport stability.
- `WorkProviderOptions.profiler.cacheStrategy` and `preferLocalAboveMhs` are declared in the nano-core API but not implemented — they are stubs. Pass `cacheStrategy: 'memory'` and `preferLocalAboveMhs: 0` to satisfy the type; they have no runtime effect yet.

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

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `XNO_MCP_HOME` | Home directory for config/state | `<installed-dir>/.xno-mcp` |
| `XNO_MCP_CACHE_DIR` | Cache directory (PoW plan, etc.) | `~/Library/Caches/xno-mcp` (macOS), `$XDG_CACHE_HOME/xno-mcp` or `~/.cache/xno-mcp` (Linux) |
| `XNO_MAX_SEND` | Max send per transaction (XNO) | `1.0` |
| `NANO_RPC_URL` | Override primary Nano node RPC URL | Public nodes |
| `XNO_WORK_URL` | Override remote PoW URL | Automatic probing |
| `powTimeoutMs` | Config field for PoW timeout override | `max(timeoutMs * 4, 30000)` |
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
- `src/state-store.ts` handles JSON file persistence (config, requests, transactions) and the PoW plan cache.
- CLI uses `commander`. MCP uses `@modelcontextprotocol/sdk`.
- `bin/xno-skills` and `bin/xno-mcp` are the npm bin entry points.

## Documentation Sync

- After modifying CLI subcommands in `src/cli.ts`, verify the README CLI table against `npm run dev -- --help`. Every subcommand listed in the README must exist, have correct flags, and have no stale entries for removed commands.
- `scripts/update-version.js` (run by `prebuild`) also **pins the version string** in `skills/nano/SKILL.md` and `README.md` — any `xno-skills@<version>` occurrence is rewritten to the current `package.json` version. Do not manually set version strings in those files.
- The agent skill lives in `skills/nano/SKILL.md` — one unified skill covering all Nano capabilities. Do not re-fragment it into per-capability files.

## Releasing

1. `npm version patch|minor|major` (runs tests, syncs `src/version.ts`).
2. `git push --follow-tags`.
3. GitHub Actions builds, tests, and publishes to npm with provenance (Trusted Publishing via OIDC).
