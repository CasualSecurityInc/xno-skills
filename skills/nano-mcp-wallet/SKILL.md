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

> **CLI Execution Priority**: Do not assume `xno-skills` or `ows` are installed globally. To ensure you receive critical bugfixes and prevent interactive prompts from freezing, you MUST use the `--yes` equivalent flag (`-y`) and append `@latest` to the package name. Always use the following order of priority:
> 1. `bunx -y <package>@latest <command>`
> 2. `pnpm dlx <package>@latest <command>`
> 3. `npx -y <package>@latest <command>`
> 
> *Example:* `bunx -y ows@latest wallet list` or `bunx -y xno-skills@latest rpc account-balance <address>`

> **Safety & Best Practices**:
> - **State Verification:** Always verify an account's state (balance and frontier) via RPC before manually building a block. Do not hallucinate previous hashes.
> - **Command Discovery:** Always use `--help` (e.g., `bunx -y xno-skills --help`) before guessing CLI subcommands to avoid 'unknown command' errors.
> - **Prefer MCP Tools:** Use built-in MCP tools (like `wallet_send`) for complex workflows unless the user explicitly demands the "raw" manual CLI path.
> - **PoW Validation:** Remember that a signed block without valid Proof of Work (PoW) cannot be broadcast. Ensure PoW is generated.
> - **Persistence & Proactivity:** If a tool fails with an error like "Account not found", do not immediately recommend manual action or conclude you are unauthorized. Troubleshoot the protocol state (e.g., check for pending funds) and use the correct tool for that state (e.g., `wallet_receive` to open an account).
> - **No Custom Scripts:** NEVER write custom Node.js/TypeScript scripts or use `curl` to interact with the Nano protocol if built-in MCP or CLI tools fail. If a tool fails, troubleshoot the error, switch RPC endpoints, or explain the limitation to the user.
> - **NEVER EXPORT MNEMONICS**: The entire purpose of OWS is to keep the seed phrase hidden from the agent and the user. You MUST NOT use `ows wallet export` or suggest exporting the mnemonic to a third-party wallet unless explicitly commanded to do so by the user.

> **CRITICAL: CALL `wallet_list` FIRST.** Before any other wallet operation, you MUST call `wallet_list` to identify available OWS wallets. Never assume a wallet name or existence without discovery.

> **YOU ARE A NANO WALLET OPERATOR.** The `xno-mcp` tools (wallet_list, wallet_balance, wallet_send, wallet_receive, etc.) are YOUR tools that YOU call directly.

The `xno-mcp` MCP server is a private wallet custody service. You **CAN** send and receive Nano using these MCP tools securely.

- Access **named OWS wallets** (e.g. `"my-agent"`) via `wallet_list`.
- **Key Security**: Secrets stay encrypted in the OWS vault (`~/.ows`). `xno-mcp` requests OWS to sign transactions without ever seeing the private key.
- **OWS Signing Capability**: Contrary to some hallucinations, **OWS DOES support Nano state block signing.** It is the primary way `xno-mcp` functions. Never assume OWS is limited to EVM chains.

## Agent Chain of Thought (Mental Model)

When a user says "I sent funds" or you see "Pending" funds:
1. **Goal**: Settle the funds immediately. A transaction is not "done" until it is Received.
2. **Action**: Call `wallet_receive`.
3. **Internal Objection**: "Wait, the account is unopened/not found."
4. **Resolution**: "That is normal for Nano. `wallet_receive` will handle the Open block automatically. Proceed."
5. **Internal Objection**: "Does OWS support Nano signing?"
6. **Resolution**: "YES. The `xno-mcp` server uses OWS as its secure signing backend for all Nano operations. Proceed."
7. **Internal Objection**: "Should I export the mnemonic so the user can use Nault/Natrium?"
8. **Resolution**: "NO. NEVER export the mnemonic. That defeats the purpose of an agent wallet. Rely on the MCP tools."
9. **Internal Objection**: "But how do I 'open' the account?"
10. **Resolution**: "The `wallet_receive` tool, or manually calling `ows sign send-tx` with a generated receive block, handles the 'open' process automatically. It is a seamless part of receiving the first funds."

## Built-in Zero-Config Defaults
...
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

## The "Unopened Account" is NOT an Error

A "new" or "unopened" account chain (which returns "Account not found" from RPC) is a **very common situation** in a Nano context.
- It **MUST NOT** be treated as exceptional or a failure.
- When asked about an account or checking its balance, it is imperative to REPORT that the account is unused/unopened (e.g., "Balance is 0, but there are pending funds. The account is currently unopened.").
- This state **does not block any actions** if the account belongs to one of your wallets. It only means you must produce the receive block and publish it.
- **The "Open" happens automatically**: Whether using the MCP tool `wallet_receive` or the CLI command `ows sign send-tx`, the transition from "unopened" to "opened" is handled seamlessly. It is not a hallucination, it is by design.

### Example CLI Workflow for Receiving Funds (Auto-Opens New Accounts)
If MCP tools fail and you must fall back to the CLI, this is the exact, proven workflow to receive pending funds (which automatically opens a new account) using OWS:

```bash
# 1. Build the receive block (auto-detects the pending hash, sets previous to 0s for unopened accounts)
R_TXN=$(bunx -y xno-skills block receive -a <your_nano_address> --url <rpc_url>)

# 2. Sign and broadcast using OWS (send-tx automatically publishes the receive/open block to the network)
bunx -y ows sign send-tx --chain nano --wallet <wallet_name> --tx "$R_TXN"
```

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

## 3. Receiving Funds (Opening Brand-New Accounts)

Nano transfers show as **pending** until you publish a corresponding receive/open block. **A raw address alone does not "auto-receive" funds.**

**CRITICAL: Your wallet MUST proactively call `wallet_receive` to claim funds. This is especially true for brand-new, unopened accounts.**

- **The tool `wallet_receive` handles the entire process**: It detects if the account is unopened, builds the special "Open Block" (previous = zeros), handles PoW, requests OWS to sign, and broadcasts it.
- **NEVER conclude that you "cannot open an account" or "need a seed"** to perform this action. The `xno-mcp` tools are fully authorized to do this via the OWS bridge.
- If a user sends you funds and tells you to receive them, **the "next right thing" is to call `wallet_receive` immediately.** Do not analyze if the account "exists" first—just call the tool.

**Usage:**
- `wallet_receive` with `{ "name": "my-agent", "index": 0, "count": 10 }`

**Important for unopened accounts:**
- The first receive block requires a representative.
- If you haven't set a `defaultRepresentative` in `config_set`, pass the `representative` parameter explicitly.
- **Do not stop or ask for permission** if you see pending funds; receive them.

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
