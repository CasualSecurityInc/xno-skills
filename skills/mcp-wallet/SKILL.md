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

## Prerequisites: RPC URL and Representative

Before using wallet operations that require network access, you need:

1. **RPC URL** - A Nano node RPC endpoint. Well-known public nodes:
   - `https://rpc.nano.org` (Nano Foundation)
   - `https://app.natrium.io/api/rpc` (Natrium)
   - `https://nanonode.cc/api` (NanoNode.cc)
   - `https://node.somenano.site/api` (SomeNano)

2. **Representative** - Required for opening new accounts. Well-known representatives:
   - `nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4` (Nano Foundation #1)
   - `nano_1stofnrxuz3cai7ze75o174bpm7scwj9jn3nxsn8ntzg784jf1gzn1jjdkou` (Nano Foundation #2)

**Recommended: Set defaults once to avoid repeating parameters:**

```json
{
  "rpcUrl": "https://rpc.nano.org",
  "defaultRepresentative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4",
  "useLocalPow": true
}
```

Call `config_set` with these values at the start of your session.

## Local PoW vs Remote PoW

By default, the wallet uses **local PoW** (`nano-pow-with-fallback`) using WASM or WebGPU. This is recommended as it doesn't rely on the RPC node supporting `work_generate`.

If you prefer to use a remote work server (e.g. a high-performance PoW service or your own node):
1. Set `useLocalPow: false` in `config_set`.
2. Provide a `workUrl` (defaults to `rpcUrl`).

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
- `wallet_probe_balances` with `{ "name": "A", "count": 5 }` - Also shows which accounts are opened

## 3. Receiving Funds (Crucial: Opening Accounts)

Nano transfers can show up as **pending** until you publish a corresponding receive/open block. A raw address alone does not "auto-receive" funds.

**If someone sends you funds, you MUST proactively call `wallet_receive` to fully pocket the funds and open the account.**

- `wallet_receive` with `{ "name": "A", "index": 0, "count": 10 }`

**Important for unopened accounts:**
- If the account is unopened (first receive), `wallet_receive` requires a representative.
- If you set `defaultRepresentative` in `config_set`, it will be used automatically.
- Otherwise, pass `representative` parameter explicitly.
- If neither is set, xno-mcp will use a well-known representative as fallback.

## 4. Sending Funds

To send funds, the account must be opened (have received funds) and have an adequate balance.
- `wallet_send` with `{ "name": "A", "index": 0, "destination": "nano_...", "amountXno": "0.01" }`

**Error: "Account is unopened"** - You must receive funds first using `wallet_receive`.

## 5. Payment Requests

For structured funding workflows (requesting XNO from operator, tracking receipt, handling refunds):
- See the `request-payment` skill for the full inbound workflow
- See the `return-funds` skill for safe refund handling

Key tools:
- `payment_request_create` — create a tracked funding request
- `payment_request_status` — check funding progress
- `payment_request_receive` — receive funds for a specific request
- `payment_request_refund` — safely return funds to sender

## 6. Spending Limits

Every `wallet_send` and `payment_request_refund` enforces a per-transaction max-send cap:

- **Default**: 1.0 XNO (set via `XNO_MAX_SEND` env var)
- **Override at runtime**: `config_set` with `{ "maxSendXno": "5.0" }`
- If a send exceeds the cap, the error tells you the current limit and how to raise it.

The cap is embedded in the `wallet_send` tool description so the agent knows the limit before trying.

## 7. Auto-Receive Before Send

When `wallet_send` detects insufficient balance but there are pending blocks, it automatically receives them before attempting the send. This avoids the common mistake of failing a send when funds are pending but not yet pocketed.

## 8. Transaction History

All sends and receives are logged persistently:
- `wallet_history` with `{ "walletName": "A", "limit": 20 }`

This includes counterparty addresses, amounts, hashes, and linked payment request IDs.

## Quick Start Example

```
1. config_set: { "rpcUrl": "https://rpc.nano.org", "defaultRepresentative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4" }
2. wallet_create: { "name": "mywallet" }
3. (User sends funds to the address)
4. wallet_receive: { "name": "mywallet" }
5. wallet_send: { "name": "mywallet", "destination": "nano_...", "amountXno": "0.01" }
```

## Notes
- Wallet persistence is enabled by default (override with `XNO_MCP_PERSIST_WALLETS=false`). If enabled, it's stored as plaintext JSON under `.xno-mcp/wallets.json`.
- The `workUrl` parameter defaults to `rpcUrl` - most nodes support work generation.
- Transaction history and payment requests are persisted alongside wallets.