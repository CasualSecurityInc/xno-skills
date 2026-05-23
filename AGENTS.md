# Agent Guidelines for xno-skills

## Core Commands
+- Use `npm` for install, build, test, versioning, and release-related commands.
+- `npm test` runs `npm run build:esm` first, then Vitest.
+- `npm run build` emits `dist/esm`; `npm run build:cjs` emits `dist/cjs`.
+- `npm run dev -- <subcommand>` runs the CLI directly via `tsx`.
+- Single test file: `npx vitest run test/<name>.test.ts`.

## Repo Wiring
+- Entry points: `src/cli.ts`, `src/mcp.ts`, `src/index.ts`.
+- Shared Nano business logic lives in `src/nano-actions.ts`.
+- `src/version.ts` is generated from `package.json`; do not edit it manually.
+- Relative imports in source must include `.js` extensions.

## Generated Artifacts
+- `scripts/update-version.js` syncs `src/version.ts`, `README.md`, and `skills/nano/SKILL.md` from `package.json`.
+- `npm run build` / `npm run build:esm` also regenerate `mcpb/server-card.json` and `skills/nano/references/*.md`.

## Nano / OWS Constraints
+- Agents never handle seeds or mnemonics directly; OWS owns key custody.
+- OWS wallets only support account index `0`.
+- `send`, `receive`, `change-rep`, and `submit-block` sign via OWS internally; `block ...` CLI commands are unsigned builders only.
+- Mock OWS mode is `XNO_MCP_MOCK_OWS=true`.

## MCP / CLI Conventions
+- Tool argument objects are untyped in the SDK; cast explicitly.
+- MCP responses should be wrapped as `{ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }`.
+- After changing CLI subcommands in `src/cli.ts`, verify the README CLI table against `npm run dev -- --help`.

## Release Flow
+- Releases go through GitHub Actions only.
+- Do **not** run `npm publish`, `pnpm release`, or any local publish command.
+- Use `npm version patch|minor|major`, then `git push --follow-tags`; the publish workflow handles npm, GitHub Release, MCPB, and Smithery.
+- `preversion` runs tests first, so release version bumps are test-gated.

## Useful Env Vars
+- `XNO_MCP_HOME` for config/state.
+- `XNO_MCP_CACHE_DIR` for PoW plan cache.
+- `XNO_MAX_SEND` for the send limit.
+- `NANO_RPC_URL` for RPC endpoint override.