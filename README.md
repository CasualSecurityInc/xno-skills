# xno-skills

[![npm version](https://img.shields.io/npm/v/xno-skills.svg)](https://www.npmjs.com/package/xno-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A CLI, MCP server, and AI skills for [Nano](https://nano.org/) (XNO). Built on top of [Open Wallet Standard (OWS)](https://github.com/open-wallet-standard/core) for secure key custody.

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
| `wallets [options]` | List wallets that have Nano accounts |
| `balance [options]` | Show balance and pending amount |
| `receive [options]` | Receive pending blocks |
| `send [options]` | Send Nano |
| `change-rep [options]` | Submit a change representative block |
| `submit-block [options]` | Sign and submit a prepared block hex |
| `history [options]` | Show transaction history |

### Utilities

| Command | Description |
|---|---|
| `info [options]` | Discover the current state and representative of any Nano account |
| `convert [options] <amount> <from>` | Convert between XNO units |
| `qr [options] <address>` | Generate a QR code for a Nano address |
| `validate [options] <input>` | Validate a Nano address or block hash |

### Cryptography & Signing

| Command | Description |
|---|---|
| `sign [options] <message>` | Sign a NOMS message with a private key |
| `verify [options] <address> <message> <signature>` | Verify a NOMS message signature |

### Advanced & RPC

| Command | Description |
|---|---|
| `rpc` | Query a Nano node RPC |
| `block` | Build unsigned Nano state blocks for manual/expert workflows |

### System

| Command | Description |
|---|---|
| `mcp` | Start the MCP server or view configuration instructions |

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
