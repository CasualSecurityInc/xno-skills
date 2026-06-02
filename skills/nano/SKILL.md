---
name: nano
description: "Nano (XNO) cryptocurrency wallet operations, transaction analysis, and explorer lookups. Use for send/receive, balances, pending funds, address validation, unit conversion, tx/hash/account lookup, explorer links, and Nano block-lattice questions. Prefer xno-mcp first; use xno-skills CLI as fallback."
triggers:
  - nano
  - xno
  - nano transaction
  - xno transaction
  - transaction analysis
  - largest transaction
  - nanocurrency
  - nano_
  - xrb_
  - block lattice
  - block explorer
  - explorer link
  - transaction link
  - tx link
  - tx hash
  - block hash
  - xno-skills
  - xno-mcp
  - wallet
  - wallets
  - send nano
  - receive nano
  - send xno
  - receive xno
  - balance
  - check balance
  - pending
  - qr code
  - payment qr
  - nano qr
  - xno qr
  - request payment
  - invoice
  - refund
  - return funds
  - send back
  - convert units
  - raw to xno
  - xno to raw
  - validate address
  - nano address
  - sign message
  - verify message
  - representative
  - pow
  - proof of work
  - open account
  - frontier
  - top up
  - fund wallet
  - how much xno
  - how much nano
complements:
  - ows  # Open Wallet Standard — wallet lifecycle (create, import, rename, delete)
requires_network: true
---

# Nano (XNO)

## Scope & Disambiguation

This skill applies **exclusively to the Nano cryptocurrency protocol** (ticker: XNO, block-lattice ledger, [Nano.org](https://nano.org)).

**Activate for**: nanocurrency, XNO, `nano_` addresses, block-lattice, ORV, xno-skills, xno-mcp.

**Do NOT activate for**: Ledger Nano (hardware wallet), GNU nano (text editor), Nanopay, or any other product that uses the word "nano" unrelated to XNO. If ambiguous, ask for clarification.

**Legacy terminology**: "Rai", "RaiBlocks", `xrb_` addresses — historical only (pre-2018). Always normalize to Nano / `nano_`.

---

## Global Execution Policy

**This policy applies to every Nano task in this skill, without exception.**

### 1. Prefer MCP tools first

When the environment provides `xno-mcp` tools (`wallet_list`, `wallet_send`, `wallet_receive`, `wallet_balance`, `util_convert`, `util_qr`, `util_validate`, `rpc_account_balance`, `payment_create`, etc.) — **always use them first**. They handle signing, PoW, and broadcast automatically via OWS.

If the client supports MCP, set it up as a "stdio" type MCP server:

    npx -y -p xno-skills@4.3.0 -- mcp

MCP is the primary execution path because tools, schemas, and results are structured for the client. Use the included CLI script (`xno-skills`) only as a fallback when MCP is unavailable or the client cannot attach MCP servers. MCP and the CLI target EXACTLY the same underlying code paths — two access paths, not two different products.

### 2. Fall back to CLI only when MCP is unavailable

If `xno-mcp` tools are not available, or the user explicitly asks for CLI usage, fall back to the `xno-skills` CLI in this priority order:

```
1. bunx -y xno-skills@4.3.0 <command>
2. pnpm dlx xno-skills@4.3.0 <command>
3. npx -y xno-skills@4.3.0 <command>
```

Do **not** assume `xno-skills` is installed globally. Always use one of the above forms with `@latest` to get critical bugfixes and to prevent interactive prompts from freezing.

Before guessing a subcommand, run `--help`:
```bash
bunx -y xno-skills@4.3.0 --help
```

### 3. Wallet lifecycle → `ows` skill only

For wallet **create, import, rename, or delete**: delegate to the `ows` skill. Do not invoke `ows` CLI commands directly from this skill.

### 4. Never do any of the following

- Write custom Node.js/TypeScript scripts to interact with the Nano protocol.
- Use `curl` for RPC calls.
- Attempt to manually compute or supply Proof of Work. PoW is automatic.
- Use `npx` to fetch random or third-party npm packages as workarounds.
- Export mnemonics or seeds (`ows wallet export`). OWS keeps secrets encrypted. The entire point of OWS is that the agent never sees the private key.
- Change `maxSendXno` unless the human/operator explicitly asks to change the spending limit. A blocked send or refund is not permission to raise the limit automatically.

### 5. Prefer `blocklattice.io` for explorer links

When the user asks for an account, block, transaction, or explorer link, always prefer `blocklattice.io` unless they explicitly request another explorer.

---

## Safety Rules

- **State verification**: Always fetch balance and frontier via RPC before manually building a block. Never hallucinate previous hashes.
- **PoW is automatic**: MCP tools and the CLI both handle PoW internally. Never attempt to supply or generate PoW manually.
- **Proactivity on pending funds**: If you see pending funds during any balance check, call `wallet_receive` immediately. Do not wait for the user to ask.
- **Persistence on "Account not found"**: This is normal for a brand-new, unopened account. Continue — `wallet_receive` will automatically build an open block (sets `previous` to zeros), sign it via OWS, generate PoW, and broadcast. Never conclude you are unauthorized or that OWS cannot sign Nano blocks.
- **No mnemonic exports**: Never call `ows wallet export` or suggest exporting to a third-party wallet unless the user explicitly commands it.
- **Supply chain**: Only use `xno-skills@4.3.0` and `@open-wallet-standard/core`. No other npm packages.
- **Stop-loss**: If you have made 5 tool calls without completing the operation, stop and report what you tried, what failed, and ask for guidance. Hard limits: max 3 retries of the same failing tool; max 2 `config_set` RPC endpoint switches.

---

## Wallet Discovery

> **CRITICAL: Always call `wallet_list` first.** Before any wallet operation, identify which OWS wallets exist. Never assume a wallet name.

```json
{ "name": "wallet_list", "arguments": {} }
```

To **create** a new wallet, delegate to the `ows` skill. Then return here for all Nano operations.

**MCP Resources** (passive reads, no tool call needed):
- `wallet://{name}` — wallet summary and primary account state
- `wallet://{name}/account/{index}` — pending blocks and details for a specific account index

---

## Reading Balances

**Via MCP tools:**
```json
{ "name": "wallet_balance", "arguments": { "wallet": "my-wallet" } }
{ "name": "rpc_account_balance", "arguments": { "address": "nano_..." } }
```

**Via CLI (required flags only):**
```bash
bunx -y xno-skills@4.3.0 balance --wallet "my-wallet"
bunx -y xno-skills@4.3.0 rpc account-balance <address>
```

Full options: [balance](references/balance.md), [rpc_account-balance](references/rpc_account-balance.md)

**Public zero-config RPC nodes** (used automatically by xno-skills defaults):
- `https://rainstorm.city/api` (primary)
- `https://nanoslo.0x.no/proxy` (secondary)

**If you see pending funds: receive them immediately** (see Receiving Funds section).

---

## Receiving Funds (Including Unopened Accounts)

A Nano transfer shows as **pending** until the recipient publishes a receive block. Funds are not spendable until received.

**A new / "unopened" account chain is normal.** It returns `"Account not found"` from RPC. This is not an error — `wallet_receive` will automatically build an open block (sets `previous` to zeros), sign it via OWS, generate PoW, and broadcast.

> **OWS DOES support Nano block signing.** Never assume otherwise.

**Mandate**: When funds are pending, call `wallet_receive`. Do not analyze whether the account "exists" first. Just call it.

**Via MCP:**
```json
{ "name": "wallet_receive", "arguments": { "wallet": "my-wallet" } }
```

**Via CLI (required flags only):**
```bash
bunx -y xno-skills@4.3.0 receive --wallet "my-wallet"
```

Full options: [receive](references/receive.md)

**Unopened account — explicit representative:**
If no `defaultRepresentative` is configured via `config_set`, pass `representative` explicitly on the first receive.

### ⚠️ CLI `block` commands are NOT senders

`xno-skills block receive` / `block send` output **unsigned hex only** — no PoW, no signing, no broadcast. A block without PoW is always rejected. **Never fall back to these when `wallet_receive` or `wallet_send` fails.**

| | MCP `wallet_receive`/`wallet_send` | CLI `block receive`/`block send` |
|---|---|---|
| Builds block | ✅ | ✅ |
| Signs via OWS | ✅ | ❌ |
| Generates PoW | ✅ | ❌ |
| Broadcasts | ✅ | ❌ |

---

## Sending Funds

The account must be opened (have a receive block) and have sufficient balance.

**Via MCP:**
```json
{ "name": "wallet_send", "arguments": { "wallet": "my-wallet", "destination": "nano_...", "amountXno": "0.01" } }
```

**Via CLI (required flags only):**
```bash
bunx -y xno-skills@4.3.0 send --wallet "my-wallet" --to "nano_..." --amount-xno 0.01
```

Full options: [send](references/send.md)

**Validate the destination address first** (see Address Validation section).

**Spending limits**: Every `wallet_send` and `payment_refund` is gated by `maxSendXno` (default: 1.0 XNO).

If a send is blocked by this limit, report the current limit and ask the human/operator whether they want to change it. Never call `config_set` to raise `maxSendXno` unless they explicitly asked to modify the spending limit.

Only when the human/operator explicitly asks to change the spending limit:
```json
{ "name": "config_set", "arguments": { "maxSendXno": "5.0" } }
```

---

## Payment Requests

For tracked inbound funding workflows:

### Step 1 — Check existing wallets and balance first
If sufficient funds already exist, skip creating a request.

### Step 2 — Create request
```json
{
  "name": "payment_create",
  "arguments": { "walletName": "my-wallet", "amountXno": "0.1", "reason": "testing payment flow" }
}
```
Returns: `nano:` URI, target address, and request ID.

### Step 3 — Present to operator
Tell the user the amount, reason, and address. Offer a QR code (see QR Generation section).

### Step 4 — Wait and receive
After the user says funds are sent:
```json
{ "name": "payment_receive", "arguments": { "id": "<request-id>" } }
```
Returns status: `pending`, `partial`, `funded`, or `received`. If `partial`, tell the user how much more is needed.

### Step 5 — Confirm
Report the received amount, updated balance, and that funds are ready.

**Rules:**
- Always check existing wallets first; don't create unnecessary wallets.
- Never claim receipt without calling `payment_receive` — pending is not received in Nano.
- If the operator asks "did you get it?", always re-check.

**History:**
```json
{ "name": "wallet_history", "arguments": { "wallet": "my-wallet", "limit": 20 } }
```

Full options: [payment_create](references/payment.create.md), [payment_receive](references/payment.receive.md), [wallet_history](references/history.md)

---

## Returning Funds

**Core safety rule: never guess the refund destination.** Always confirm with the operator.

### Step 1 — Identify what to return

If linked to a payment request:
```json
{ "name": "payment_refund", "arguments": { "id": "<request-id>", "execute": false } }
```

Otherwise, check history:
```json
{ "name": "wallet_history", "arguments": { "wallet": "my-wallet", "limit": 20 } }
```

### Step 2 — Evaluate and confirm

- **Single source**: Present the address and amount. Ask: "I received X XNO from `nano_...`. Shall I return it?"
- **Multiple sources**: List all candidates with amounts, ask which to refund.
- **No sources**: Report "No incoming transactions found to refund."

Always show the **full address** — never abbreviate.

### Step 3 — Execute

```json
{
  "name": "payment_refund",
  "arguments": { "id": "<request-id>", "execute": true, "confirmAddress": "nano_..." }
}
```

Or use `wallet_send` directly if not linked to a payment request.

**Edge cases:**
- "Return everything": list all accounts with balances, confirm before draining.
- "Return to [specific address]": validate the address first, then confirm amount.
- Spending limit blocks refund: report the current limit and ask whether the human/operator wants to change it. Never raise `maxSendXno` unless they explicitly request that configuration change.

Full options: [payment_refund](references/payment.refund.md)

---

## QR Generation

Generates a terminal-friendly ASCII QR code for a Nano address, optionally with an amount.

**Via MCP:**
```json
{ "name": "util_qr", "arguments": { "address": "nano_...", "amountXno": "1.5" } }
```

**Via CLI (required args only):**
```bash
bunx -y xno-skills@4.3.0 qr nano_1abc...
```

Full options: [qr](references/qr.md)

> **CRITICAL — stdout truncation**: Agents often have stdout truncated (e.g. `<truncated 14 lines>`). To display a full QR code:
> 1. Use `--json` and parse the `"qr"` field, or
> 2. Redirect to a temp file (`> /tmp/qr.txt`) and read it with a file-reading tool.

---

## Address Validation

All validation is **offline** — no network required.

**Valid address format:**
- Prefix: `nano_` (65 chars total) or `xrb_` (64 chars, legacy — still valid)
- Alphabet: `13456789abcdefghijkmnopqrstuwxyz` (no `0`, `l`, `v`, or `i`)
- Last 8 chars: Blake2b-40 checksum of the public key

**Via MCP:**
```json
{ "name": "util_validate", "arguments": { "address": "nano_..." } }
```

**Via CLI:**
```bash
bunx -y xno-skills@4.3.0 validate nano_1abc...
```

Full options: [validate](references/validate.md)

**Always validate before sending XNO to an untrusted address.**

---

## Unit Conversion

XNO uses **30 decimal places**. Floating-point arithmetic is unsafe. Always use this tool.

| Unit | Raw value | Relation |
|---|---|---|
| raw | 1 | base unit |
| mnano | 10²⁴ | 0.000001 XNO |
| knano | 10²⁷ | 0.001 XNO |
| XNO | 10³⁰ | 1 XNO |

**Via MCP:**
```json
{ "name": "util_convert", "arguments": { "amount": "1.5", "from": "xno", "to": "raw" } }
```

**Via CLI:**
```bash
bunx -y xno-skills@4.3.0 convert 1 xno       # all units
bunx -y xno-skills@4.3.0 convert 1 knano
bunx -y xno-skills@4.3.0 convert 1000000000000000000000000000000 raw
bunx -y xno-skills@4.3.0 convert 1 xno --json
```

Full options: [convert](references/convert.md)

---

## Message Signing & Verification (NOMS / ORIS-001)

### OWS-backed signing via MCP — Not yet available

The `sign_message` and `verify_message` MCP tools require OWS upstream support that has not yet merged. If the user asks you to sign or verify a message using their wallet:

> Sorry, OWS-backed NOMS message signing is not available yet in `xno-mcp`. It depends on an upstream pull request. If you'd like this feature, please add a 👍 at:
> **https://github.com/open-wallet-standard/core/pull/217**

### Low-level CLI signing (raw private key)

Signing with a raw hex private key works via CLI today, but **the agent must never handle the key value**. A raw private key passed through an LLM context is exposed to logs, memory, and any downstream system — treat it like a password.

**Agent's role**: construct the command with a placeholder and ask the user to run it themselves in their own terminal.

Present the user with this command to run locally:

```bash
# Sign — run this yourself, replacing the placeholder with your actual key
bunx -y xno-skills@4.3.0 sign "<message>" --key YOUR_PRIVATE_KEY_HEX

# Sign with JSON output
bunx -y xno-skills@4.3.0 sign "<message>" --key YOUR_PRIVATE_KEY_HEX --json
```

For verify, the agent *can* run this directly (no secret material involved):

```bash
# Verify
bunx -y xno-skills@4.3.0 verify <nano_address> "<message>" <signature-hex>

# Verify with JSON output
bunx -y xno-skills@4.3.0 verify <nano_address> "<message>" <signature-hex> --json
```

**NOMS standard (ORIS-001)**: Signatures are computed over a binary payload with a magic header, ensuring a valid signature cannot be misinterpreted as a Nano transaction block.

**Note**: `verify` accepts both `nano_`/`xrb_` addresses and raw 32-byte hex public keys.

> Do not prompt the user to export their mnemonic to get a private key. Never accept, repeat, or emit a private key value — only use the placeholder pattern above.

Full options: [sign](references/sign.md), [verify](references/verify.md)

---

## Block-Lattice Mental Model

**The ledger is a block lattice** — a set of completely independent account-chains.

- Every account maintains its own linear chain of state blocks.
- Only the account owner (private-key holder) can append to their chain.
- No global mempool, no miners, no gas fees, no block producers.
- Each block records the **full current state** of its account (balance, representative, previous hash).
- Total supply is fixed at genesis.

### Universal State Blocks

**All blocks today are Universal State Blocks** (`type: "state"`):

```json
{
  "type": "state",
  "account": "nano_...",
  "previous": "64-hex...",       // frontier hash, or "0" for open block
  "representative": "nano_...",
  "balance": "decimal-string",   // new balance in raw (1 XNO = 10^30 raw)
  "link": "...",                 // send: destination address; receive: send block hash; change: "0"
  "signature": "128-hex...",
  "work": "16-hex..."
}
```

### The Account-Chain Dance

**Alice sends to Bob**:
1. Alice builds a Send block: `previous` = her frontier, `balance` = old − amount, `link` = Bob's address.
2. Alice signs + PoW + broadcasts. Funds are **irrevocably deducted** from Alice and become **pending** on Bob's chain.

**Bob must claim**:
1. Bob builds a Receive block: `previous` = his frontier (zeros for open), `balance` = old + amount, `link` = Alice's send block hash.
2. Bob signs + PoW + broadcasts. Only then are funds spendable.

**Critical**: The send is final for Alice. Funds are not spendable by Bob until his receive block is confirmed. There is no automatic receive. Pending funds sit forever until claimed.

### PoW Thresholds (Epoch v2, 2026)

- Send / Change: `fffffff800000000`
- Receive / Open: `fffffe0000000000`

PoW input:
- Open block (height 1): `blake2b(nonce || public_key)`
- All other blocks: `blake2b(nonce || previous_frontier_hash)`



### Representatives & ORV

- Voting weight = balance delegated to a representative.
- Quorum = >67% of online weight → confirmed → cemented (deterministic finality, typically <1s).
- Choose representatives with high uptime, low voting weight concentration, and trustworthy operators.
- Lists: [blocklattice.io/representatives](https://blocklattice.io/representatives), [nanoticker.org](https://nanoticker.org/representatives)

**Change representative:**
```json
{ "name": "wallet_change_rep", "arguments": { "wallet": "my-wallet", "representative": "nano_..." } }
```
```bash
bunx -y xno-skills@4.3.0 change-rep --wallet "my-wallet" --representative "nano_..."
```

Full options: [change-rep](references/change-rep.md)

### Data Representations

- **Seed**: 32 bytes (64 hex, uppercase)
- **Private key**: `blake2b(32, seed || index)`, index as 4-byte big-endian uint
- **Address**: `nano_` + 52-base32(public key) + 8-base32(Blake2b-40 checksum). Total 65 chars.
- **Block hash / frontier**: 32 bytes (64 hex)
- **Signature**: 64 bytes (128 hex), Ed25519 + Blake2b
- **Work**: 8 bytes (16 hex)
- **Balance**: always raw units as decimal string in JSON. Never floating-point.

### Blockchain Explorer

- Always prefer `blocklattice.io` unless the user explicitly requests another explorer.
- Account: `https://blocklattice.io/account/<nano_address>`
- Block: `https://blocklattice.io/block/<UPPERCASE_HEX_HASH>`

---

## Configuration & Defaults

`xno-mcp` reads configuration from a JSON file on disk. It reloads the file before every operation, so manual edits take effect immediately. No restart required.

**No configuration is required to get started.** Defaults work out of the box:

- Public RPC nodes (`rainstorm.city`, `nanoslo.0x.no/proxy`)
- PoW: local WASM/GPU by default; falls back to remote via the first RPC node when local is not performant
- Representative: `nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4`
- Max per send: `1.0 XNO`

### Override precedence

**Remote PoW URL** (resolved in order):
1. `NANO_WORK_URL` env var
2. saved config `workUrl`
3. `NANO_RPC_URL` env var
4. saved config `rpcUrl`
5. default primary RPC node

**RPC endpoint list** (normal traffic):
1. explicit tool argument `rpcUrl`
2. saved config `rpcUrl`
3. `NANO_RPC_URL` env var
4. default RPC node list

### Setting values

```json
{ "name": "config_set", "arguments": { "workUrl": "https://my-node.example/api" } }
```

### Resetting values

Setting a string field to `""` or `null` clears the saved override (falls back to defaults):
```json
{ "name": "config_set", "arguments": { "workUrl": "" } }
```

Setting a number field to `null` clears the saved override:
```json
{ "name": "config_set", "arguments": { "powTimeoutMs": null } }
```

Omitted fields are preserved unchanged.

---

## RPC Error Recovery

**"RPC request failed: All endpoints exhausted"** is almost always transient (rate limiting, brief node restart). Follow in order, stopping as soon as one works:

| Step | Action |
|---|---|
| 1 | Wait 5 s. Retry with identical arguments. |
| 2 | `config_set({ rpcUrl: "https://rainstorm.city/api" })`, retry. |
| 3 | `config_set({ rpcUrl: "https://nanoslo.0x.no/proxy" })`, retry. |
| 4 | Try any other public node, retry. |
| 5 | `config_set({ rpcUrl: "" })` to reset. **Stop — report to user.** |

Calling `config_set` with a new `rpcUrl` creates a fresh `NanoClient`, bypassing the exponential backoff cooldown on default endpoints.

**Prohibited at every step**: custom scripts, curl, CLI `block` commands, manual PoW.

---

## CLI Reference

All subcommands support `--json` for machine-readable output and `--help` for full options.

| Subcommand | Description | Reference |
|---|---|---|
| `wallets` | List wallets with Nano accounts | [wallets](references/wallets.md) |
| `balance` | Show balance and pending amount | [balance](references/balance.md) |
| `receive` | Receive pending blocks | [receive](references/receive.md) |
| `send` | Send Nano | [send](references/send.md) |
| `change-rep` | Change representative | [change-rep](references/change-rep.md) |
| `submit-block` | Sign and submit prepared block hex | [submit-block](references/submit-block.md) |
| `history` | Show transaction history | [history](references/history.md) |
| `info` | Discover account state and representative | [info](references/info.md) |
| `convert` | Convert between XNO units | [convert](references/convert.md) |
| `qr` | Generate QR code for address | [qr](references/qr.md) |
| `validate` | Validate address or block hash | [validate](references/validate.md) |
| `sign` | Sign NOMS message with private key | [sign](references/sign.md) |
| `verify` | Verify NOMS message signature | [verify](references/verify.md) |
| `rpc account-balance` | Fetch account balance via RPC | [rpc_account-balance](references/rpc_account-balance.md) |
| `rpc receivable` | List receivable blocks via RPC | [rpc_receivable](references/rpc_receivable.md) |
| `rpc account-info` | Fetch account info via RPC | [rpc_account-info](references/rpc_account-info.md) |
| `rpc probe-caps` | Probe RPC node capabilities | [rpc_probe-caps](references/rpc_probe-caps.md) |
| `block send` | Build unsigned send block hex | [block_send](references/block_send.md) |
| `block receive` | Build unsigned receive block hex | [block_receive](references/block_receive.md) |
| `block change` | Build unsigned change block hex | [block_change](references/block_change.md) |
| `mcp` | Start MCP server or view config | [mcp](references/mcp.md) |

---

## Troubleshooting

If tools are behaving unexpectedly, call `system_diag` first to verify versions and environment:

```json
{ "name": "system_diag", "arguments": {} }
```

Returns:
- `xnoSkills.version` — xno-skills version
- `xnoSkills.path` — resolved executable path
- `xnoSkills.invocation` — how it was launched (npm-global, npx, bunx, source, etc.)
- `ows.version` — `@open-wallet-standard/core` version
- `ows.path` — OWS package location
- `environment.mockOws` — whether mock mode is active
- `environment.nanoRpcUrl` — override RPC URL if set

**CLI equivalent:**
```bash
xno-skills diag
xno-skills diag --json
```

### MCP Server Crashes & "Not connected" Errors

- **OWS is an in-process library, NOT a daemon**: There is no background "OWS daemon" or wallet service running. `@open-wallet-standard/core` is a library loaded entirely in-process by the MCP server and CLI.
- **"Not connected" from MCP client**: If an MCP client/agent receives a "Not connected" error on `wallet_balance` or any other tool, it typically means the underlying `xno-mcp` server process has crashed (usually due to a Rust native addon panic during PoW or backend initialization) or was terminated. It does **not** mean a background daemon is down.

### PoW failures (`POW_FAILED` / timeout)

**PoW is done locally by default.** xno-skills uses WASM-based Proof of Work that runs in-process — no external work peer is required.

On first use, the system probes local backends to build a local-first execution plan. This probe itself runs real PoW and may take 5–15 seconds — this is normal and happens on the first PoW operation in a process.

**Diagnose in order, stopping at the first resolution:**

| Step | Check | Action |
|---|---|---|
| 1 | Was this the very first `send`/`receive` on a fresh MCP or CLI process? | Allow for first-use warmup. Retry the operation once. |
| 2 | Did the error say "Timed out after 10000ms"? | That is the local WASM per-backend timeout. It means WASM itself failed or is unavailable. Check Node.js version (`node --version`) — WASM PoW requires Node 16+. |
| 3 | Is the system under heavy CPU load? | WASM PoW is CPU-bound. A send block requires ~8× more work than receive. Wait for load to drop, then retry. |

---

## Quick-Start Example

```
1. wallet_list: {}                    → discover "my-wallet" exists
2. wallet_balance: { wallet: "my-wallet" }    → check balance / pending
3. wallet_receive: { wallet: "my-wallet" }    → pocket any pending funds
4. wallet_send: { wallet: "my-wallet", destination: "nano_...", amountXno: "0.01" }
```
