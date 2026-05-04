---
name: nano
description: "You are a Nano (XNO) wallet operator and protocol expert. Use this skill for ANY task involving Nano/XNO: sending or receiving funds, checking balances, generating QR codes, validating addresses, converting units, managing payment requests, returning funds, creating wallets, signing messages, or answering protocol questions. Works via xno-mcp (MCP server) with xno-skills CLI as fallback. Even if the user just says 'send nano', 'did I get it?', 'make a QR', 'how much is 1 XNO in raw?', or 'what is a block lattice?' — this skill covers it."
triggers:
  - nano
  - xno
  - nanocurrency
  - nano_
  - xrb_
  - block lattice
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
---

# Nano (XNO)

## Scope & Disambiguation

This skill applies **exclusively to the Nano cryptocurrency protocol** (ticker: XNO, block-lattice ledger, docs.nano.org).

**Activate for**: nanocurrency, XNO, `nano_` addresses, block-lattice, ORV, xno-skills, xno-mcp.

**Do NOT activate for**: Ledger Nano (hardware wallet), GNU nano (text editor), Nanopay, or any other product that uses the word "nano" unrelated to XNO. If ambiguous, ask for clarification.

**Legacy terminology**: "Rai", "RaiBlocks", `xrb_` addresses — historical only (pre-2018). Always normalize to Nano / `nano_`.

---

## Global Execution Policy

**This policy applies to every Nano task in this skill, without exception.**

### 1. Prefer MCP tools first

When the environment provides `xno-mcp` tools (`wallets`, `send`, `receive`, `balance`, `convert_units`, `generate_qr`, `validate_address`, `rpc_account_balance`, `payment_request_create`, etc.) — **always use them first**. They handle signing, PoW, and broadcast automatically via OWS.

### 2. Fall back to CLI only when MCP is unavailable

If `xno-mcp` tools are not available, or the user explicitly asks for CLI usage, fall back to the `xno-skills` CLI in this priority order:

```
1. bunx -y xno-skills@latest <command>
2. pnpm dlx xno-skills@latest <command>
3. npx -y xno-skills@latest <command>
```

Do **not** assume `xno-skills` is installed globally. Always use one of the above forms with `@latest` to get critical bugfixes and to prevent interactive prompts from freezing.

Before guessing a subcommand, run `--help`:
```bash
bunx -y xno-skills@latest --help
```

### 3. Wallet lifecycle → `ows` skill only

For wallet **create, import, rename, or delete**: delegate to the `ows` skill. Do not invoke `ows` CLI commands directly from this skill.

### 4. Never do any of the following

- Write custom Node.js/TypeScript scripts to interact with the Nano protocol.
- Use `curl` for RPC calls.
- Attempt to manually compute or supply Proof of Work. PoW is automatic.
- Use `npx` to fetch random or third-party npm packages as workarounds.
- Export mnemonics or seeds (`ows wallet export`). OWS keeps secrets encrypted. The entire point of OWS is that the agent never sees the private key.

---

## Safety Rules

- **State verification**: Always fetch balance and frontier via RPC before manually building a block. Never hallucinate previous hashes.
- **PoW is automatic**: MCP tools and the CLI both handle PoW internally. Never attempt to supply or generate PoW manually.
- **Proactivity on pending funds**: If you see pending funds during any balance check, call `receive` immediately. Do not wait for the user to ask.
- **Persistence on "Account not found"**: This is normal for a brand-new, unopened account. Continue — `receive` will build the open block automatically. Never conclude you are unauthorized or that OWS cannot sign Nano blocks.
- **No mnemonic exports**: Never call `ows wallet export` or suggest exporting to a third-party wallet unless the user explicitly commands it.
- **Supply chain**: Only use `xno-skills@latest` and `@open-wallet-standard/core`. No other npm packages.
- **Stop-loss**: If you have made 5 tool calls without completing the operation, stop and report what you tried, what failed, and ask for guidance. Hard limits: max 3 retries of the same failing tool; max 2 `config_set` RPC endpoint switches.

---

## Wallet Discovery

> **CRITICAL: Always call `wallets` first.** Before any wallet operation, identify which OWS wallets exist. Never assume a wallet name.

```
wallets: {}
```

To **create** a new wallet, delegate to the `ows` skill. Then return here for all Nano operations.

**MCP Resources** (passive reads, no tool call needed):
- `wallet://{name}` — wallet summary and primary account state
- `wallet://{name}/account/{index}` — pending blocks and details for a specific account index

---

## Reading Balances

**Via MCP tools:**
```json
{ "name": "balance", "arguments": { "wallet": "my-wallet", "index": 0 } }
{ "name": "rpc_account_balance", "arguments": { "address": "nano_..." } }
```

**Via CLI:**
```bash
bunx -y xno-skills@latest balance --wallet "my-wallet"
bunx -y xno-skills@latest rpc account-balance <address> --json
```

**Public zero-config RPC nodes** (used automatically by xno-skills defaults):
- `https://rainstorm.city/api` (primary)
- `https://nanoslo.0x.no/proxy` (secondary)

**If you see pending funds: receive them immediately** (see Receiving Funds section).

---

## Receiving Funds (Including Unopened Accounts)

A Nano transfer shows as **pending** until the recipient publishes a receive block. Funds are not spendable until received.

**A new / "unopened" account chain is normal.** It returns `"Account not found"` from RPC. This is not an error — `receive` will automatically build an open block (sets `previous` to zeros), sign it via OWS, generate PoW, and broadcast.

> **OWS DOES support Nano block signing.** Never assume otherwise.

**Mandate**: When funds are pending, call `receive`. Do not analyze whether the account "exists" first. Just call it.

**Via MCP:**
```json
{ "name": "receive", "arguments": { "wallet": "my-wallet", "index": 0, "count": 10 } }
```

**Via CLI:**
```bash
bunx -y xno-skills@latest receive --wallet "my-wallet"
```

**Unopened account — explicit representative:**
If no `defaultRepresentative` is configured via `config_set`, pass `representative` explicitly on the first receive.

### ⚠️ CLI `block` commands are NOT senders

`xno-skills block receive` / `block send` output **unsigned hex only** — no PoW, no signing, no broadcast. A block without PoW is always rejected. **Never fall back to these when `receive` or `send` fails.**

| | MCP `receive`/`send` | CLI `block receive`/`block send` |
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
{ "name": "send", "arguments": { "wallet": "my-wallet", "index": 0, "destination": "nano_...", "amountXno": "0.01" } }
```

**Via CLI:**
```bash
bunx -y xno-skills@latest send --wallet "my-wallet" --destination "nano_..." --amount-xno 0.01
```

**Validate the destination address first** (see Address Validation section).

**Spending limits**: Every `send` and `payment_request_refund` is gated by `maxSendXno` (default: 1.0 XNO). Override:
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
  "name": "payment_request_create",
  "arguments": { "walletName": "my-wallet", "amountXno": "0.1", "reason": "testing payment flow" }
}
```
Returns: `nano:` URI, target address, and request ID.

### Step 3 — Present to operator
Tell the user the amount, reason, and address. Offer a QR code (see QR Generation section).

### Step 4 — Wait and receive
After the user says funds are sent:
```json
{ "name": "payment_request_receive", "arguments": { "id": "<request-id>" } }
```
Returns status: `pending`, `partial`, `funded`, or `received`. If `partial`, tell the user how much more is needed.

### Step 5 — Confirm
Report the received amount, updated balance, and that funds are ready.

**Rules:**
- Always check existing wallets first; don't create unnecessary wallets.
- Never claim receipt without calling `payment_request_receive` — pending is not received in Nano.
- If the operator asks "did you get it?", always re-check.

**History:**
```json
{ "name": "history", "arguments": { "wallet": "my-wallet", "limit": 20 } }
```

---

## Returning Funds

**Core safety rule: never guess the refund destination.** Always confirm with the operator.

### Step 1 — Identify what to return

If linked to a payment request:
```json
{ "name": "payment_request_refund", "arguments": { "id": "<request-id>", "execute": false } }
```

Otherwise, check history:
```json
{ "name": "history", "arguments": { "wallet": "my-wallet", "limit": 20 } }
```

### Step 2 — Evaluate and confirm

- **Single source**: Present the address and amount. Ask: "I received X XNO from `nano_...`. Shall I return it?"
- **Multiple sources**: List all candidates with amounts, ask which to refund.
- **No sources**: Report "No incoming transactions found to refund."

Always show the **full address** — never abbreviate.

### Step 3 — Execute

```json
{
  "name": "payment_request_refund",
  "arguments": { "id": "<request-id>", "execute": true, "confirmAddress": "nano_..." }
}
```

Or use `send` directly if not linked to a payment request.

**Edge cases:**
- "Return everything": list all accounts with balances, confirm before draining.
- "Return to [specific address]": validate the address first, then confirm amount.
- Spending limit blocks refund: tell the user to increase via `config_set({ maxSendXno: "..." })`.

---

## QR Generation

Generates a terminal-friendly ASCII QR code for a Nano address, optionally with an amount.

**Via MCP:**
```json
{ "name": "generate_qr", "arguments": { "address": "nano_...", "amountXno": "1.5" } }
```

**Via CLI:**
```bash
# Address only
bunx -y xno-skills@latest qr nano_1abc...

# With amount
bunx -y xno-skills@latest qr nano_1abc... --amount-xno 1.5

# JSON output (recommended for agents — avoids stdout truncation)
bunx -y xno-skills@latest qr nano_1abc... --amount-xno 1.5 --json
```

> **CRITICAL — stdout truncation**: Agents often have stdout truncated (e.g. `<truncated 14 lines>`). To display a full QR code:
> 1. Use `--json` and parse the `"qr"` field, or
> 2. Redirect to a temp file (`> /tmp/qr.txt`) and read it with a file-reading tool.

JSON output contains:
- `content`: canonical `nano:` URI (`nano:<address>?amount=<raw>`)
- `qr`: the full ASCII QR block

The CLI validates the address before generating the QR.

---

## Address Validation

All validation is **offline** — no network required.

**Valid address format:**
- Prefix: `nano_` (65 chars total) or `xrb_` (64 chars, legacy — still valid)
- Alphabet: `13456789abcdefghijkmnopqrstuwxyz` (no `0`, `l`, `v`, or `i`)
- Last 8 chars: Blake2b-40 checksum of the public key

**Via MCP:**
```json
{ "name": "validate_address", "arguments": { "address": "nano_..." } }
```

**Via CLI:**
```bash
bunx -y xno-skills@latest validate nano_1abc...
```

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
{ "name": "convert_units", "arguments": { "amount": "1.5", "from": "xno", "to": "raw" } }
```

**Via CLI:**
```bash
bunx -y xno-skills@latest convert 1 xno       # all units
bunx -y xno-skills@latest convert 1 knano
bunx -y xno-skills@latest convert 1000000000000000000000000000000 raw
bunx -y xno-skills@latest convert 1 xno --json
```

---

## Message Signing & Verification (NOMS / ORIS-001)

### OWS-backed signing via MCP — Not yet available

The `sign_message` and `verify_message` MCP tools require OWS upstream support that has not yet merged. If the user asks you to sign or verify a message using their wallet:

> Sorry, OWS-backed NOMS message signing is not available yet in `xno-mcp`. It depends on an upstream pull request. If you'd like this feature, please add a 👍 at:
> **https://github.com/open-wallet-standard/core/pull/217**

### Low-level CLI signing (raw private key)

If the user provides a **hex private key**, signing and verification work via CLI today:

```bash
# Sign
bunx -y xno-skills@latest sign "<message>" --key <private-key-hex>

# Sign with JSON output
bunx -y xno-skills@latest sign "<message>" --key <private-key-hex> --json

# Verify
bunx -y xno-skills@latest verify <nano_address> "<message>" <signature-hex>

# Verify with JSON output
bunx -y xno-skills@latest verify <nano_address> "<message>" <signature-hex> --json
```

**NOMS standard (ORIS-001)**: Signatures are computed over a binary payload with a magic header, ensuring a valid signature cannot be misinterpreted as a Nano transaction block.

**Note**: `verify` accepts both `nano_`/`xrb_` addresses and raw 32-byte hex public keys.

> Do not prompt the user to export their mnemonic to get a private key. Only use the raw-key CLI path if they provide a hex private key directly.

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

To probe whether an RPC endpoint supports remote `work_generate`:
```bash
bunx -y xno-skills@latest rpc probe-caps <url>
```
Never use `curl` to probe this.

### Representatives & ORV

- Voting weight = balance delegated to a representative.
- Quorum = >67% of online weight → confirmed → cemented (deterministic finality, typically <1s).
- Choose representatives with high uptime, low voting weight concentration, and trustworthy operators.
- Lists: [blocklattice.io/representatives](https://blocklattice.io/representatives), [nanoticker.org](https://nanoticker.org/representatives)

**Change representative:**
```json
{ "name": "change_rep", "arguments": { "wallet": "my-wallet", "representative": "nano_..." } }
```
```bash
bunx -y xno-skills@latest change-rep --wallet "my-wallet" --representative "nano_..."
```

### Data Representations

- **Seed**: 32 bytes (64 hex, uppercase)
- **Private key**: `blake2b(32, seed || index)`, index as 4-byte big-endian uint
- **Address**: `nano_` + 52-base32(public key) + 8-base32(Blake2b-40 checksum). Total 65 chars.
- **Block hash / frontier**: 32 bytes (64 hex)
- **Signature**: 64 bytes (128 hex), Ed25519 + Blake2b
- **Work**: 8 bytes (16 hex)
- **Balance**: always raw units as decimal string in JSON. Never floating-point.

### Blockchain Explorer

- Account: `https://blocklattice.io/account/<nano_address>`
- Block: `https://blocklattice.io/block/<UPPERCASE_HEX_HASH>`

---

## Configuration & Defaults

As of v1.1.0, `xno-mcp` uses public RPC nodes and standard representatives automatically. No configuration required to get started.

**Optional overrides:**
```json
{ "name": "config_set", "arguments": { "rpcUrl": "https://rainstorm.city/api", "defaultRepresentative": "nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4" } }
```

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

## Quick-Start Example

```
1. wallets: {}                    → discover "my-wallet" exists
2. balance: { wallet: "my-wallet" }    → check balance / pending
3. receive: { wallet: "my-wallet" }    → pocket any pending funds
4. send: { wallet: "my-wallet", destination: "nano_...", amountXno: "0.01" }
```
