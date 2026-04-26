---
name: nano-mcp-wallet
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

> **CLI Execution Priority**: Do not assume `xno-skills` or `ows` are installed globally. When executing CLI commands, always use the following order of priority to ensure successful execution:
> 1. `bunx -y <command>`
> 2. `pnpm dlx <command>`
> 3. `npx -y <command>`
> 
> *Example:* `bunx -y ows wallet list` or `bunx -y xno-skills rpc account-balance <address>`

> **Safety & Best Practices**:
> - **State Verification:** Always verify an account's state (balance and frontier) via RPC before manually building a block. Do not hallucinate previous hashes.
> - **Command Discovery:** Always use `--help` (e.g., `bunx -y xno-skills --help`) before guessing CLI subcommands to avoid 'unknown command' errors.
> - **Prefer MCP Tools:** Use built-in MCP tools (like `wallet_send`) for complex workflows unless the user explicitly demands the "raw" manual CLI path.
> - **PoW Validation:** Remember that a signed block without valid Proof of Work (PoW) cannot be broadcast. Ensure PoW is generated.
> - **No Custom Scripts:** NEVER write custom Node.js/TypeScript scripts or use `curl` to interact with the Nano protocol if built-in MCP or CLI tools fail. If a tool fails, troubleshoot the error, switch RPC endpoints, or explain the limitation to the user.

> **CRITICAL: CALL `wallet_list` FIRST.** Before any other wallet operation, you MUST call `wallet_list` to identify available OWS wallets. Never assume a wallet name or existence without discovery.

> **YOU ARE A NANO WALLET OPERATOR.** The `xno-mcp` tools (wallet_list, wallet_balance, wallet_send, wallet_receive, etc.) are YOUR tools that YOU call directly.

The `xno-mcp` MCP server is a private wallet custody service. You **CAN** send and receive Nano using these MCP tools securely.

- Access **named OWS wallets** (e.g. `"my-agent"`) via `wallet_list`.
- **Key Security**: Secrets stay encrypted in the OWS vault (`~/.ows`). `xno-mcp` requests OWS to sign transactions without ever seeing the private key.

## Built-in Zero-Config Defaults

As of v1.1.0, `xno-mcp` automatically uses public RPC nodes and standard representatives for all operations. You do **NOT** need to configure anything to get started.

### Overriding Defaults (Optional)

If you prefer to use specific endpoints or your own node, you can override the built-in defaults:

1. **RPC URL** - A specific Nano node RPC endpoint.
2. **Representative** - Required for opening new accounts if you want to use someone other than the default.

**Optional: Set overrides if needed:**

```json
{
  "rpcUrl": "https://rpc.nano.org",
  "defaultRepresentative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4",
  "useWorkPeer": true
}
```

Call `config_set` with these values at the start of your session only if you need non-default behavior.

## Local PoW vs Remote PoW

By default, the wallet uses **automatic PoW selection** from `@openrai/nano-core`. It probes your local environment (WASM, WebGPU) and available public/remote work peers to find the fastest way to generate work. No configuration is required.

## 1. Discovering OWS Wallets

Call MCP tool:
- `wallet_list` to see which wallets exist in your OWS vault.

To create a new wallet, use the `ows` CLI (outside of MCP) or the `nano-create-wallet` skill instructions.

## Troubleshooting: "Account Not Found" (Receiving First Funds)
On the Nano network, an account does not exist on the ledger until its first receive block (often called an "open" block) is published.
- If you check a balance or attempt to build a block and receive an `"Account not found"` error, **this is normal for a brand new wallet**.
- **Do not** write custom scripts to bypass this.
- If a wallet has pending funds but no balance, use `wallet_receive` or `xno-skills block receive`. The tools are designed to automatically handle the transition from "unopened" to "opened" by setting the `previous` hash to all zeros (`00000...`).
- If the tool still fails, the configured RPC node may be offline or misconfigured. Use `config_set` to switch to a reliable public node like `https://rpc.nano.org`.

## 2. Reading Balances (MCP Resources & Tools)
...
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
1. wallet_list: {}  (identify "my-agent" exists)
2. (User sends funds to the address)
3. wallet_receive: { "name": "my-agent" }
4. wallet_send: { "name": "my-agent", "destination": "nano_...", "amountXno": "0.01" }
```
