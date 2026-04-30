# xno-skills

[![npm version](https://img.shields.io/npm/v/xno-skills.svg)](https://www.npmjs.com/package/xno-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A CLI, MCP server, and AI skills for Nano (XNO). Pairs with [Open Wallet Standard (OWS)](https://github.com/open-wallet-standard/core) for secure key custody.

![xno-skills CLI preview](assets/xno-skills-cli.png)

## AI Skills

Built-in skills for AI agents (Claude Code, Cursor, etc.):

```bash
npx skills add CasualSecurityInc/xno-skills
```

Available skills:
- `nano-check-balance`: Check balance/pending via Nano node RPC.
- `nano-convert-units`: High-precision unit conversion reference.
- `nano-create-wallet`: Wallet creation/import guidance (BIP39/Legacy support).
- `nano-generate-qr`: Terminal-friendly Nano payment QR codes.
- `nano-mcp-wallet`: Use `xno-mcp` as a private "wallet" custody blackbox.
- `nano-request-payment`: Request XNO from operator (payment request workflow).
- `nano-return-funds`: Return XNO to sender safely.
- `nano-sign-message`: Sign off-chain messages (NOMS/ORIS-001).
- `nano-validate-address`: Address format and checksum verification.
- `nano-verify-message`: Verify off-chain message signatures.
- `nano-block-lattice-expert`: Deep protocol wisdom and 2026 operational facts.

## CLI

```bash
npm install -g xno-skills
xno-skills --help
```

### Wallet Operations

| Command | Description |
|---|---|
| `wallets` | List wallets that have Nano accounts |
| `balance --wallet <name>` | Show balance and pending amount |
| `receive --wallet <name>` | Receive pending blocks |
| `send --wallet <name> --to <addr> --amount-xno <n>` | Send Nano |
| `change-rep --wallet <name> --representative <addr>` | Change representative |
| `submit-block --wallet <name> --tx-hex <hex> --subtype <type>` | Sign and submit a prepared block hex |
| `history --wallet <name>` | Show transaction history |

### Utilities

| Command | Description |
|---|---|
| `info --wallet <name>` or `--address <addr>` | Account state, representative, weight |
| `convert <amount> <from>` | Convert units (xno, raw, mnano, knano) |
| `qr <address>` | Generate QR code (ASCII or `--format svg`) |
| `validate <input>` | Validate a Nano address |

### Cryptography & Signing

| Command | Description |
|---|---|
| `sign <message> --key <hex>` | Sign a NOMS message with a private key |
| `verify <address> <message> <signature>` | Verify a NOMS message signature |

### Advanced & RPC

| Command | Description |
|---|---|
| `rpc account-balance <address>` | Fetch balance from a Nano node |
| `rpc receivable <address>` | List receivable blocks |
| `rpc account-info <address>` | Fetch account info |
| `rpc probe-caps [url]` | Probe node capabilities |
| `block send -a <addr> -t <addr> --amount-xno <n>` | Build unsigned send block |
| `block receive`, `block change` | Build unsigned receive/change blocks |

### System

| Command | Description |
|---|---|
| `mcp` | Start the MCP server |

All commands support `-j` / `--json` for machine-readable output.

Wallet lifecycle (create, import, rename, delete) is managed by [OWS](https://github.com/open-wallet-standard/core). `xno-skills` bundles OWS as a dependency — no separate install needed. See the [OWS quick-start](https://openwallet.sh/#quickstart) for terminal usage, or install OWS agent skills with `npx skills add open-wallet-standard/core@ows`.

## MCP Server

Exposes Nano wallet functions as tools for AI agents (Claude Desktop, Cursor, Codex, etc.).

```json
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "-p", "xno-skills@latest", "xno-mcp"]
    }
  }
}
```

### Tools

| Tool | Description |
|---|---|
| `wallets` | List OWS wallets and their Nano addresses |
| `address` | Get the Nano address for a wallet account index |
| `balance` | Check confirmed balance and pending |
| `receive` | Receive pending blocks (handles open automatically) |
| `send` | Send XNO (max per tx configurable via `config_set`) |
| `change_rep` | Change the representative for a wallet |
| `submit_block` | Broadcast a pre-signed block hex |
| `history` | View on-chain transaction history |
| `info` | Account state and representative for any address |
| `convert_units` | High-precision unit conversion |
| `validate_address` | Offline address validation |
| `rpc_account_balance` | Direct RPC balance check for any address |
| `generate_qr` | Generate ASCII or SVG QR codes |
| `sign_message` / `verify_message` | Off-chain message signing (NOMS) |
| `ows_health_check` | Verify OWS wallet daemon is reachable |
| `payment_request_create` | Create a tracked payment request |
| `payment_request_list` | List payment requests |
| `payment_request_status` | Check payment request status |
| `payment_request_receive` | Receive funds for a payment request |
| `payment_request_refund` | Refund a payment request |
| `config_get` / `config_set` | Manage RPC URL, representative, spending cap |

> **Compatibility aliases**: `wallet_list`, `wallet_balance`, `wallet_receive`, `wallet_send`, `wallet_history` map to the canonical tools above.

### Client Setup Examples

<details>
<summary>Codex</summary>

```bash
codex mcp add xno \
  -c sandbox_mode="danger-full-access" \
  -c 'sandbox_permissions=["network-access"]' \
  -- npx -y -p xno-skills@latest xno-mcp
```
</details>

<details>
<summary>Claude Desktop (<code>claude_desktop_config.json</code>)</summary>

```json
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "-p", "xno-skills@latest", "xno-mcp"]
    }
  }
}
```
</details>

<details>
<summary>OpenCode (<code>opencode.jsonc</code>)</summary>

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "xno": {
      "type": "local",
      "command": ["npx", "-y", "-p", "xno-skills@latest", "xno-mcp"],
      "enabled": true
    }
  }
}
```
</details>

<details>
<summary>Gemini CLI (<code>settings.json</code>)</summary>

```json
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "-p", "xno-skills@latest", "xno-mcp"]
    }
  }
}
```
</details>

<details>
<summary>VS Code (<code>.vscode/mcp.json</code>)</summary>

```json
{
  "servers": {
    "xno": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "-p", "xno-skills@latest", "xno-mcp"]
    }
  }
}
```
</details>

## Library

For using `xno-skills` as a TypeScript library, see [LIBRARY.md](./LIBRARY.md).

## Security Notes

- **Never share your seed or private keys.** Anyone with access can fully control your wallet.
- **Store seeds securely.** Use hardware wallets or encrypted storage — never in plain text or version control.
- **Address validation.** Always validate addresses before sending. Nano addresses include checksums.
- **Unit precision.** Nano uses 30 decimal places. Always use string-based conversion to avoid floating-point errors.

## Development

```bash
npm install
npm test
npm run build
```

## Releasing

See `RELEASING.md`.

## Similar Projects

- [kilkelly/nano-currency-mcp-server](https://github.com/kilkelly/nano-currency-mcp-server) — MCP server for Nano with a simple per-transaction send limit
- [strawberry-labs/berrypay-cli](https://github.com/strawberry-labs/berrypay-cli) — Nano wallet CLI for AI agents with payment processing and auto-sweep

## License

MIT
