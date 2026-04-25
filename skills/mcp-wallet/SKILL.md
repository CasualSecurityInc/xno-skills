---
name: mcp-wallet
description: "You ARE a Nano (XNO) wallet operator via xno-mcp (bridging OWS). You can list wallets, check balances, send and receive XNO using OWS keys. Call wallet_list first."
triggers:
  - purse
  - wallet
  - wallets
  - create a wallet
  - custody
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
  - what wallets
  - list wallets
  - my wallets
  - have access to
  - which wallets
  - show wallets
  - wallet access
  - nano wallets
  - xno wallets
  - do you have a wallet
  - do you have wallets
  - your wallets
  - your wallet
  - registered wallets
  - available wallets
  - wallet list
  - check wallet
  - check wallets
  - nano account
  - xno account
  - my account
  - my accounts
  - balance
  - check balance
  - how much xno
  - how much nano
---

# xno-mcp Wallet Custody (via OWS)

> **YOU ARE A NANO WALLET OPERATOR.** The `xno-mcp` tools (wallet_list, wallet_balance, wallet_send, wallet_receive, etc.) are YOUR tools that YOU call directly. You do NOT need the user to execute anything. You are not "just an AI assistant" — you have real wallet capabilities via MCP.

> **Key Custody**: Key management is delegated to the **Open Wallet Standard (OWS)**. `xno-mcp` acts as an orchestrator that bridges OWS wallets with the Nano network.

> **When the user asks about wallets, funds, or Nano**: Call `wallet_list` FIRST to see what OWS wallets are available to you. Do not say "I don't have access" — you DO have access.

The `xno-mcp` MCP server is a private wallet custody service. You **CAN** send and receive Nano using these MCP tools securely.

- Access **named OWS wallets** (e.g. `"my-agent"`) via `wallet_list`.
- **Key Security**: Secrets stay encrypted in the OWS vault (`~/.ows`). `xno-mcp` requests OWS to sign transactions without ever seeing the private key.

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
  "useWorkPeer": true
}
```

Call `config_set` with these values at the start of your session.

## Local PoW vs Remote PoW

By default, the wallet uses **local PoW** (`nano-pow-with-fallback`) using WASM or WebGPU. This is recommended as it doesn't rely on the RPC node supporting `work_generate`.

If you prefer to use a remote work server (e.g. a high-performance PoW service or your own node):
1. Set `useWorkPeer: true` in `config_set`.
2. Provide a `workPeerUrl` (defaults to `rpcUrl`).

## 1. Discovering OWS Wallets

Call MCP tool:
- `wallet_list` to see which wallets exist in your OWS vault.

To create a new wallet, use the `ows` CLI (outside of MCP) or the `create-wallet` skill instructions.

## 2. Reading Balances (MCP Resources & Tools)

**Passively reading state via MCP Resources (Recommended):**
You can passively read the available accounts, their open state, and balances by requesting the MCP Resource URI:
- `wallet://{name}` - Returns a summary of the wallet and its first 5 accounts.
- `wallet://{name}/account/{index}` - Returns specific pending blocks and details for an account index.

**Actively reading state via Tools:**
- `wallet_balance` with `{ "name": "my-agent", "index": 0 }`

## 3. Receiving Funds (Crucial: Opening Accounts)

Nano transfers can show up as **pending** until you publish a corresponding receive/open block. A raw address alone does not "auto-receive" funds.

**If someone sends you funds, you MUST proactively call `wallet_receive` to fully pocket the funds and open the account.**

- `wallet_receive` with `{ "name": "my-agent", "index": 0, "count": 10 }`

**Important for unopened accounts:**
- If the account is unopened (first receive), `wallet_receive` requires a representative.
- If you set `defaultRepresentative` in `config_set`, it will be used automatically.
- Otherwise, pass `representative` parameter explicitly.

## 4. Sending Funds

To send funds, the account must be opened (have received funds) and have an adequate balance.
- `wallet_send` with `{ "name": "my-agent", "index": 0, "destination": "nano_...", "amountXno": "0.01" }`

**Error: "Account is unopened"** - You must receive funds first using `wallet_receive`.

## 5. Payment Requests

For inbound funding workflows:
- `payment_request_create` — create a tracked funding request linked to an OWS wallet
- `payment_request_status` — check funding progress
- `payment_request_receive` — receive funds for a specific request
- `payment_request_refund` — safely return funds to sender

## 6. Spending Limits

Every `wallet_send` and `payment_request_refund` enforces a per-transaction max-send cap:

- **Default**: 1.0 XNO
- **Override at runtime**: `config_set` with `{ "maxSendXno": "5.0" }`

## 7. Transaction History

All sends and receives are logged persistently:
- `wallet_history` with `{ "walletName": "my-agent", "limit": 20 }`

## Quick Start Example

```
1. config_set: { "rpcUrl": "https://rpc.nano.org", "defaultRepresentative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4" }
2. wallet_list: {}  (identify "my-agent" exists)
3. (User sends funds to the address)
4. wallet_receive: { "name": "my-agent" }
5. wallet_send: { "name": "my-agent", "destination": "nano_...", "amountXno": "0.01" }
```
