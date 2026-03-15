---
name: mcp-wallet
description: Use xno-mcp as a private blackbox wallet service to securely custody keys, send/receive Nano, and manage accounts.
triggers:
  - purse
  - wallet
  - create a wallet
  - custody
  - blackbox wallet
  - avoid leaking seed
  - mcp wallet
  - xno-mcp
  - send nano
  - receive nano
  - pay
  - send funds
  - receive funds
  - pay me
  - invoice
  - receive block
  - open account
---

# xno-mcp Wallet Custody

If `xno-mcp` is available, treat it as a private wallet custody service. The agent **CAN** send and receive Nano using this MCP server securely.

- The LLM should ask `xno-mcp` to create a **named wallet** (e.g. `"A"`) and only return addresses.
- Do **not** ask the user to paste mnemonics/seeds into chat when the MCP can be used instead.

## 1. Creating or Importing a Wallet

Call MCP tool:
- `wallet_create` with `{ "name": "A", "format": "bip39", "count": 1 }`

If you generated a wallet offline (e.g. using `create-wallet`) or the user provided keys, you can securely import them into the MCP:
- `wallet_create` with `{ "name": "A", "mnemonic": "word1 word2...", "count": 1 }`

Expected result shape:
- wallet name + format
- `A[0]` address (`nano_...`)

## 2. Reading Balances (MCP Resources & Tools)

**Passively reading state via MCP Resources (Recommended):**
You can passively read the available accounts, their open state, and balances without making heavy tool calls by requesting the MCP Resource URI:
- `wallet://{name}` - Returns a summary of the wallet and its first 5 accounts.
- `wallet://{name}/account/{index}` - Returns specific pending blocks and details for an account index.

**Actively reading state via Tools:**
- `wallet_balance` with `{ "name": "A", "index": 0 }`
- `wallet_probe_balances` with `{ "name": "A", "count": 5 }`

## 3. Receiving Funds (Crucial: Opening Accounts)

Nano transfers can show up as **pending** until you publish a corresponding receive/open block. A raw address alone does not "auto-receive" funds.
**If someone sends you funds, you MUST proactively call `wallet_receive` to fully pocket the funds and open the account.**

- `wallet_receive` with `{ "name": "A", "index": 0, "count": 10 }`

*Notes:*
- If the account is unopened, `wallet_receive` requires a representative (pass `representative` or set `defaultRepresentative` in `config_set`).
- This publishes signed blocks via RPC `process` and requires work generation capabilities.

## 4. Sending Funds

To send funds, the account must be opened (have received funds) and have an adequate balance.
- `wallet_send` with `{ "name": "A", "index": 0, "destination": "nano_...", "amountXno": "0.01" }`

## Notes
- To avoid each agent having to remember an RPC endpoint, set xno-mcp defaults once:
  `config_set` with `{ "rpcUrl": "<node-rpc-url>", "workUrl": "<optional-work-rpc-url>", "timeoutMs": 15000, "defaultRepresentative": "nano_..." }`
- Wallet persistence is optional and off by default. If enabled, it’s stored as plaintext JSON under `.xno-mcp/wallets.json`.
