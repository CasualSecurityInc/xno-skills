# Agent Guidelines for xno-skills

This file contains non-discoverable landmines and workflow gotchas for the xno-skills repository.

## Non-Discoverable Tooling

### Open Wallet Standard (OWS) Requirement
The project **delegates all key management** to [OWS](https://github.com/open-wallet-standard). 
- **Landmine**: Primary Nano actions now go through OWS via native TypeScript bindings, not the raw `ows` CLI. Do not reintroduce shell-based `ows` flows into `xno-skills` or its skills.
- **Custody**: Agents **never** handle seeds or mnemonics directly. Use `wallets` / `address` to discover existing OWS-backed Nano accounts.
- **Signing**: `send`, `receive`, `change`, and `submit-block` trigger OWS signing internally. `block ...` commands remain unsigned construction helpers only.

### ESM Import Requirement
- **Landmine**: All relative imports **MUST** include the `.js` extension (e.g., `import { foo } from './foo.js';`). Failure to do so will break the ESM build.

### Documentation Sync
- **Rule**: After modifying `src/cli.ts`, **always** verify the README's CLI usage section against `npm run dev -- --help`.
- **Checklist**: Ensure every subcommand listed in the README (1) exists in the CLI, (2) has correct flags/description, and (3) has no stale entries for removed commands.
- **Trigger**: Any addition, removal, or flag change to CLI subcommands.

---

## MCP Server Landmines

### Spending Limit
- Every `send` and `payment_request_refund` is gated by a **per-transaction cap** (`maxSendXno`).
- Default: `1.0` XNO.
- Modification: Use `config_set({ maxSendXno: "..." })` or the `XNO_MAX_SEND` environment variable.

### Persistence Paths
State is stored in `${XNO_MCP_HOME}` (default: `~/.xno-mcp` or project root).
- `config.json`: RPC URLs and app settings.
- `requests.json`: Tracked payment requests.
- `transactions.json`: Local transaction ledger for `history`.
- **Note**: OWS wallets themselves are stored in `~/.ows`, separate from `xno-skills` state.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `XNO_MCP_HOME` | Home directory for config/state | `<installed-dir>/.xno-mcp` |
| `XNO_MAX_SEND` | Max send per transaction (XNO) | `1.0` |
| `NANO_RPC_URL` | Override primary Nano node RPC URL | Zero-config public nodes |
| `XNO_WORK_URL` | Override remote PoW (work_generate) URL | Automatic local/remote probing |


---

## MCP Tooling Patterns

### Argument Handling
Tool arguments are untyped in the SDK. Use explicit casting:
```typescript
const walletName = String((args as any)?.name);
const index = Number((args as any)?.index ?? 0);
```

### Return Pattern
Always wrap the response in the standard MCP text content format:
```typescript
return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
```

### Response Text Access
In tests, access response text via:
```typescript
(result.content[0] as any).text
```
