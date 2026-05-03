---
name: nano-mcp-wallet
description: "You ARE a Nano (XNO) wallet operator via xno-mcp. Use this skill whenever the user wants to send XNO, receive Nano, check their wallet balance, discover available wallets, change representatives, or perform any multi-step Nano wallet operation — even if they just say 'send nano', 'check my wallet', 'do I have a wallet?', or 'pay this address'. Always call `wallets` first to enumerate available Nano wallets. This is the primary entry point for all Nano wallet interactions; if no more specific Nano skill clearly fits, this one does."
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

> **CLI Execution Priority**: Do not assume `xno-skills` is installed globally. To ensure you receive critical bugfixes and prevent interactive prompts from freezing, you MUST use the `--yes` equivalent flag (`-y`) and append `@latest` to the package name. Always use the following order of priority:
> 1. `bunx -y xno-skills@latest <command>`
> 2. `pnpm dlx xno-skills@latest <command>`
> 3. `npx -y xno-skills@latest <command>`
>
> For Nano actions, prefer MCP tools first, then `xno-skills` CLI verbs. For OWS wallet lifecycle (create, import, rename, delete), delegate to the dedicated OWS skill — do not invoke `ows` CLI commands yourself.
>
> *Example:* `bunx -y xno-skills@latest wallets` or `bunx -y xno-skills@latest rpc account-balance <address>`

> **Safety & Best Practices**:
> - **State Verification:** Always verify an account's state (balance and frontier) via RPC before manually building a block. Do not hallucinate previous hashes.
> - **Command Discovery:** Always use `--help` (e.g., `bunx -y xno-skills --help`) before guessing CLI subcommands to avoid 'unknown command' errors.
> - **Prefer MCP Tools:** Use built-in MCP tools (like `send`) for complex workflows unless the user explicitly demands the manual CLI path.
> - **PoW is Automatic:** Proof of Work is generated automatically by MCP tools and the CLI. Never attempt to generate or supply PoW manually.
> - **Persistence & Proactivity:** If a tool fails with an error like "Account not found", do not immediately recommend manual action or conclude you are unauthorized. Troubleshoot the protocol state (e.g., check for pending funds) and use the correct tool for that state (e.g., `receive` to open an account).
> - **No Custom Scripts:** NEVER write custom Node.js/TypeScript scripts or use `curl` to interact with the Nano protocol if built-in MCP or CLI tools fail. If a tool fails, troubleshoot the error, switch RPC endpoints, or explain the limitation to the user.
> - **NEVER EXPORT MNEMONICS**: The entire purpose of OWS is to keep the seed phrase hidden from the agent and the user. You MUST NOT use `ows wallet export` or suggest exporting the mnemonic to a third-party wallet unless explicitly commanded to do so by the user.
> - **Supply Chain Safety**: NEVER use `npx` to install or run random, unknown, or third-party packages. Only use the approved tools provided in this project (`xno-skills@latest` and `@open-wallet-standard/core`). If a task cannot be performed with these tools, do not seek external npm packages as a workaround.

> **CRITICAL: CALL `wallets` FIRST.** Before any other wallet operation, you MUST call `wallets` to identify available OWS wallets. Never assume a wallet name or existence without discovery.

> **🛑 STOP-LOSS — Prevent Failure Spirals**: If you have made **5 tool calls** without completing the requested operation, **STOP** and report to the user: what you tried, what failed, and ask for guidance. Hard limits per operation: max **3 retries** of the same failing tool; max **2 RPC endpoint switches** via `config_set`; no custom scripts, no curl, no manual block construction.

> **YOU ARE A NANO WALLET OPERATOR.** The `xno-mcp` tools (`wallets`, `address`, `balance`, `send`, `receive`, `change_rep`, etc.) are YOUR tools that YOU call directly.

The `xno-mcp` MCP server is a private wallet custody service. You **CAN** send and receive Nano using these MCP tools securely.

- Access **named OWS wallets** (e.g. `"my-agent"`) via `wallets`.
- **Key Security**: Secrets stay encrypted in the OWS vault (`~/.ows`). `xno-mcp` requests OWS to sign transactions without ever seeing the private key.
- **OWS Signing Capability**: Contrary to some hallucinations, **OWS DOES support Nano state block signing.** It is the primary way `xno-mcp` functions. Never assume OWS is limited to EVM chains.

## Agent Chain of Thought (Mental Model)

When a user says "I sent funds" or you see "Pending" funds:
1. **Goal**: Settle the funds immediately. A transaction is not "done" until it is Received.
2. **Action**: Call `receive`.
3. **Internal Objection**: "Wait, the account is unopened/not found."
4. **Resolution**: "That is normal for Nano. `receive` will handle the Open block automatically. Proceed."
5. **Internal Objection**: "Does OWS support Nano signing?"
6. **Resolution**: "YES. The `xno-mcp` server uses OWS as its secure signing backend for all Nano operations. Proceed."
7. **Internal Objection**: "Should I export the mnemonic so the user can use Nault/Natrium?"
8. **Resolution**: "NO. NEVER export the mnemonic. That defeats the purpose of an agent wallet. Rely on the MCP tools."
9. **Internal Objection**: "But how do I 'open' the account?"
10. **Resolution**: "The `receive` MCP tool handles the 'open' process automatically — PoW, signing, and broadcast are all included. Just call it."

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
  "rpcUrl": "https://rainstorm.city/api",
  "defaultRepresentative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4"
}
```

Call `config_set` with these values at the start of your session only if you need non-default behavior.

## Local PoW vs Remote PoW

By default, the wallet uses **automatic PoW selection** from `@openrai/nano-core`. It probes your local environment (WASM, WebGPU) and available public/remote work peers to find the fastest way to generate work. No configuration is required.

## 1. Discovering OWS Wallets

Call MCP tool:
- `wallets` to see which wallets exist in your OWS vault.

To create a new wallet, use the separate OWS skill (the `nano-create-wallet` skill). Do not invoke `ows` CLI commands directly.

## The "Unopened Account" is NOT an Error

A "new" or "unopened" account chain (which returns "Account not found" from RPC) is a **very common situation** in a Nano context.
- It **MUST NOT** be treated as exceptional or a failure.
- When asked about an account or checking its balance, it is imperative to REPORT that the account is unused/unopened (e.g., "Balance is 0, but there are pending funds. The account is currently unopened.").
- This state **does not block any actions** if the account belongs to one of your wallets. It only means you must produce the receive block and publish it.
- **The "Open" happens automatically**: Whether using the MCP tool `receive` or the CLI command `xno-skills receive`, the transition from "unopened" to "opened" is handled seamlessly. It is not a hallucination, it is by design.

### ⚠️ CLI `block` Commands Are NOT Transaction Senders

`xno-skills block receive` and `xno-skills block send` output **unsigned block hex with no Proof of Work and no broadcast**. A block without valid PoW is always rejected as "Block is invalid." They are raw construction tools only.

| Capability | MCP `receive` / `send` | CLI `block receive` / `block send` |
|---|---|---|
| Builds block | ✅ | ✅ |
| Signs via OWS | ✅ | ❌ |
| Generates PoW | ✅ (automatic) | ❌ (outputs placeholder zeros) |
| Broadcasts to network | ✅ | ❌ |

**Never fall back to CLI `block` commands when `receive` or `send` fails.** They cannot complete the operation. Follow the Error Recovery Protocol below.

## Error Recovery: "RPC request failed: All endpoints exhausted"

This error is almost always **transient** (rate limiting, brief node restart). It does NOT mean the MCP server is broken. Required response — follow in strict order, stopping as soon as one works:

| Step | Action |
|------|--------|
| 1 | Wait 5 seconds. Retry `receive` with **identical** arguments. |
| 2 | `config_set({ rpcUrl: "https://rainstorm.city/api" })`, then retry. |
| 3 | `config_set({ rpcUrl: "https://nanoslo.0x.no/proxy" })`, then retry. |
| 4 | `config_set({ rpcUrl: "https://some-other-node/rpc" })` — try any other public node, then retry. |
| 5 | Reset override: `config_set({ rpcUrl: "" })`. **STOP — report to user.** |

> **Why this works:** The MCP server is long-lived. When default endpoints get rate-limited, `@openrai/nano-core` puts them on exponential backoff cooldown. Calling `config_set` with a new `rpcUrl` creates a fresh `NanoClient` with only that URL, bypassing the cooldown state on the defaults. OWS has its own persisted RPC config for `nano:mainnet` (accessible via `ows config show`) but xno-skills deliberately bypasses it — it uses its own RPC config via `config_set` / `state.config.rpcUrl`.

**Prohibited at every step:** writing scripts, using curl, CLI `block` commands, or manual PoW generation.

## Troubleshooting: "Account Not Found" (Receiving First Funds)
On the Nano network, an account does not exist on the ledger until its first receive block (often called an "open" block) is published.
- If you check a balance or attempt to build a block and receive an `"Account not found"` error, **this is normal for a brand new wallet**.
- **Do not** write custom scripts to bypass this.
- If a wallet has pending funds but no balance, use `receive`. The tool is designed to automatically handle the transition from "unopened" to "opened" by setting the `previous` hash to all zeros (`00000...`).
- If the tool still fails, follow the **Error Recovery Protocol** above — try `rainstorm.city/api`, then `nanoslo.0x.no/proxy`, then stop and report to the user.

## 2. Reading Balances (MCP Resources & Tools)
...
**Passively reading state via MCP Resources (Recommended):**
You can passively read the available accounts, their open state, and balances by requesting the MCP Resource URI:
- `wallet://{name}` - Returns a summary of the wallet and its primary Nano account state.
- `wallet://{name}/account/{index}` - Returns specific pending blocks and details for a Nano account index.

**Actively reading state via Tools:**
- `balance` with `{ "wallet": "my-agent", "index": 0 }`

## 3. Receiving Funds (Opening Brand-New Accounts)

Nano transfers show as **pending** until you publish a corresponding receive/open block. **A raw address alone does not "auto-receive" funds.**

**CRITICAL: Your wallet MUST proactively call `receive` to claim funds. This is especially true for brand-new, unopened accounts.**

- **The tool `receive` handles the entire process**: It detects if the account is unopened, builds the special "Open Block" (previous = zeros), handles PoW, requests OWS to sign, and broadcasts it.
- **NEVER conclude that you "cannot open an account" or "need a seed"** to perform this action. The `xno-mcp` tools are fully authorized to do this via the OWS bridge.
- If a user sends you funds and tells you to receive them, **the "next right thing" is to call `receive` immediately.** Do not analyze if the account "exists" first—just call the tool.

**Usage:**
- `receive` with `{ "wallet": "my-agent", "index": 0, "count": 10 }`

**Important for unopened accounts:**
- The first receive block requires a representative.
- If you haven't set a `defaultRepresentative` in `config_set`, pass the `representative` parameter explicitly.
- **Do not stop or ask for permission** if you see pending funds; receive them.

## 4. Sending Funds

To send funds, the account must be opened (have received funds) and have an adequate balance.
- `send` with `{ "wallet": "my-agent", "index": 0, "destination": "nano_...", "amountXno": "0.01" }`

**Error: "Account is unopened"** - You must receive funds first using `receive`.

## 5. Payment Requests

For inbound funding workflows:
- `payment_request_create` — create a tracked funding request linked to an OWS wallet
- `payment_request_status` — check funding progress
- `payment_request_receive` — receive funds for a specific request
- `payment_request_refund` — safely return funds to sender

## 6. Spending Limits

Every `send` and `payment_request_refund` enforces a per-transaction max-send cap:

- **Default**: 1.0 XNO
- **Override at runtime**: `config_set` with `{ "maxSendXno": "5.0" }`

All confirmed transactions for a wallet can be viewed via RPC:
- `history` with `{ "wallet": "my-agent", "limit": 20 }`

## Quick Start Example

```
1. wallets: {}  (identify "my-agent" exists)
2. (User sends funds to the address)
3. receive: { "wallet": "my-agent" }
4. send: { "wallet": "my-agent", "destination": "nano_...", "amountXno": "0.01" }
```
