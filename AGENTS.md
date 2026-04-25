# Agent Guidelines for xno-skills

This file contains non-discoverable landmines and workflow gotchas for the xno-skills repository.

## Non-Discoverable Tooling

### Open Wallet Standard (OWS) Requirement
The project **delegates all key management** to [OWS](https://github.com/open-wallet-standard). 
- **Landmine**: The `xno-mcp` server and `xno-skills block` commands will fail if the `ows` CLI is not available (natively or via `npx`).
- **Custody**: Agents **never** handle seeds or mnemonics directly. Use `wallet_list` to discover existing OWS wallets.
- **Signing**: Constructing blocks (CLI) or sending/receiving (MCP) triggers OWS to sign. The agent provides the `walletName` and `index`.

### ESM Import Requirement
- **Landmine**: All relative imports **MUST** include the `.js` extension (e.g., `import { foo } from './foo.js';`). Failure to do so will break the ESM build.

---

## MCP Server Landmines

### Spending Limit
- Every `wallet_send` and `payment_request_refund` is gated by a **per-transaction cap** (`maxSendXno`).
- Default: `1.0` XNO.
- Modification: Use `config_set({ maxSendXno: "..." })` or the `XNO_MAX_SEND` environment variable.

### Persistence Paths
State is stored in `${XNO_MCP_HOME}` (default: `~/.xno-mcp` or project root).
- `config.json`: RPC URLs and app settings.
- `requests.json`: Tracked payment requests.
- `transactions.json`: Local transaction ledger for `wallet_history`.
- **Note**: OWS wallets themselves are stored in `~/.ows`, separate from `xno-skills` state.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `XNO_MCP_HOME` | Home directory for config/state | `<installed-dir>/.xno-mcp` |
| `XNO_MAX_SEND` | Max send per transaction (XNO) | `1.0` |
| `NANO_RPC_URL` | Primary Nano node RPC URL | — |
| `XNO_WORK_URL` | Remote PoW (work_generate) URL | — |
| `XNO_USE_WORK_PEER`| Prefer `XNO_WORK_URL` over local PoW | `false` |

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
