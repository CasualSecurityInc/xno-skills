---
name: nano
description: "Nano (XNO) cryptocurrency wallet operations, transaction analysis, and explorer lookups. Use for send/receive, balances, pending funds, address validation, unit conversion, tx/hash/account lookup, explorer links, and Nano block-lattice questions. Prefer xno-mcp first; use xno-skills CLI as fallback. Configured OWS wallets ARE the assistant's own wallets — never claim you cannot receive or hold Nano."
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

## Wallet Ownership & Agent Authority

Wallets returned by `wallet_list` are wallets configured for this assistant environment. Treat them as **assistant-controlled wallets** for Nano operations.

**The assistant may**:

- list wallets;
- inspect balances, pending funds, history, and representatives;
- receive funds into an assistant-controlled wallet;
- provide an assistant-controlled receiving address;
- send funds when the user explicitly requests it.

> **Never say** "I don't have a wallet", "I can't receive funds", or "the skill only operates wallets you control" when `wallet_list` exposes configured wallets.

**Disambiguation**: "Send me Nano" means send to an **assistant-controlled wallet**, unless the user names another recipient. Do not reinterpret it as a request to send to a hypothetical personal wallet, and do not refuse on that basis.

Before any wallet operation, call `wallet_list`. If the user says they want to send Nano to the assistant, list the wallets, identify a suitable receiving wallet/address, and present the full address (never abbreviated). Do not initiate a receive until the user asks to claim funds or a payment workflow requires it.

---

## Global Execution Policy

**This policy applies to every Nano task in this skill, without exception.**

### 1. Prefer MCP tools first

When the environment provides `xno-mcp` tools (`wallet_list`, `wallet_send`, `wallet_receive`, `wallet_balance`, `util_convert`, `util_qr`, `util_validate`, `rpc_account_balance`, `payment_create`, etc.) — **always use them first**. They handle signing, PoW, and broadcast automatically via OWS.

If the client supports MCP, set it up as a "stdio" type MCP server.

**Preferred — global install** (avoids `npx` concurrency issues that cause handshake failures):

    npm install -g xno-skills@4.7.4
    xno-skills mcp

**Fallback** (only if global install is not possible):

    npx -y xno-skills@4.7.4 mcp

> **Why not `npx` by default?** When multiple agent sessions start concurrently, `npx` can fail during package resolution — the second process exits before the MCP handshake completes. A global install eliminates this race.

MCP is the primary execution path because tools, schemas, and results are structured for the client. Use the included CLI script (`xno-skills`) only as a fallback when MCP is unavailable or the client cannot attach MCP servers. MCP and the CLI target EXACTLY the same underlying code paths — two access paths, not two different products.

### 2. Fall back to CLI only when MCP is unavailable

If `xno-mcp` tools are not available, or the user explicitly asks for CLI usage, use the `xno-skills` CLI in this priority order:

```
1. xno-skills <command>              (global install — preferred)
2. bunx -y xno-skills@4.7.4 <command>
3. pnpm dlx xno-skills@4.7.4 <command>
4. npx -y xno-skills@4.7.4 <command>
```

If the global `xno-skills` binary is not available, fall through to the next option. Always pin the version (`@4.5.2`) with `bunx`/`pnpm dlx`/`npx` to prevent interactive prompts from freezing.

Before guessing a subcommand, run `--help`:
```bash
xno-skills --help              # or: bunx -y xno-skills@4.7.4 --help
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
- **Pre-send state**: Before `wallet_send`, inspect the source wallet's confirmed balance and total receivable amount with `wallet_balance`. If confirmed funds cannot cover the requested send and receivables are needed, call `wallet_receive`, then recheck. Do not submit receive blocks merely because unrelated funds are pending.
- **Persistence on "Account not found"**: This is normal for a brand-new, unopened account. Continue — `wallet_receive` will automatically build an open block (sets `previous` to zeros), sign it via OWS, generate PoW, and broadcast. Never conclude you are unauthorized or that OWS cannot sign Nano blocks.
- **No mnemonic exports**: Never call `ows wallet export` or suggest exporting to a third-party wallet unless the user explicitly commands it.
- **Supply chain**: Only use `xno-skills@4.7.4` and `@open-wallet-standard/core`. No other npm packages.
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
bunx -y xno-skills@4.7.4 balance --wallet "my-wallet"
bunx -y xno-skills@4.7.4 rpc account-balance <address>
```

Full options: [balance](references/balance.md), [rpc_account-balance](references/rpc_account-balance.md)

**Public zero-config RPC nodes** (used automatically by xno-skills defaults):
- `https://rainstorm.city/api` (primary)
- `https://nanoslo.0x.no/proxy` (secondary)
- `https://rpc.nano.to` (tertiary)

Pending funds are not spendable. Receive them only when the user asks to claim them or they are needed for the requested operation (see Receiving Funds section).

---

## Receiving Funds (Including Unopened Accounts)

A Nano transfer shows as **pending** until the recipient publishes a receive block. Funds are not spendable until received.

**A new / "unopened" account chain is normal.** It returns `"Account not found"` from RPC. This is not an error — `wallet_receive` will automatically build an open block (sets `previous` to zeros), sign it via OWS, generate PoW, and broadcast.

> **OWS DOES support Nano block signing.** Never assume otherwise.

When receipt is requested or needed to fund a send, call `wallet_receive`. Do not treat an unopened account as a blocker: `wallet_receive` handles the open block.

**Via MCP:**
```json
{ "name": "wallet_receive", "arguments": { "wallet": "my-wallet" } }
```

**Via CLI (required flags only):**
```bash
bunx -y xno-skills@4.7.4 receive --wallet "my-wallet"
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

**Preflight**: Call `wallet_balance` for the source wallet before each send. If its confirmed balance is insufficient but its receivable amount can cover the requested send, call `wallet_receive` and recheck before sending. Do not receive unrelated pending funds solely because they exist.

**Via MCP:**
```json
{ "name": "wallet_send", "arguments": { "wallet": "my-wallet", "destination": "nano_...", "amountXno": "0.01" } }
```

**Via CLI (required flags only):**
```bash
bunx -y xno-skills@4.7.4 send --wallet "my-wallet" --to "nano_..." --amount-xno 0.01
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
bunx -y xno-skills@4.7.4 qr nano_1abc...
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
bunx -y xno-skills@4.7.4 validate nano_1abc...
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
bunx -y xno-skills@4.7.4 convert 1 xno       # all units
bunx -y xno-skills@4.7.4 convert 1 knano
bunx -y xno-skills@4.7.4 convert 1000000000000000000000000000000 raw
bunx -y xno-skills@4.7.4 convert 1 xno --json
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
bunx -y xno-skills@4.7.4 sign "<message>" --key YOUR_PRIVATE_KEY_HEX

# Sign with JSON output
bunx -y xno-skills@4.7.4 sign "<message>" --key YOUR_PRIVATE_KEY_HEX --json
```

For verify, the agent *can* run this directly (no secret material involved):

```bash
# Verify
bunx -y xno-skills@4.7.4 verify <nano_address> "<message>" <signature-hex>

# Verify with JSON output
bunx -y xno-skills@4.7.4 verify <nano_address> "<message>" <signature-hex> --json
```

**NOMS standard (ORIS-001)**: Signatures are computed over a binary payload with a magic header, ensuring a valid signature cannot be misinterpreted as a Nano transaction block.

**Note**: `verify` accepts both `nano_`/`xrb_` addresses and raw 32-byte hex public keys.

> Do not prompt the user to export their mnemonic to get a private key. Never accept, repeat, or emit a private key value — only use the placeholder pattern above.

Full options: [sign](references/sign.md), [verify](references/verify.md)

---

## Nano Protocol Reference

The ledger is a block lattice of independent account-chains. Every block is a Universal State Block carrying full account state (balance, representative, previous hash). A send is final immediately; funds become spendable only when the recipient publishes a receive/open block. Pending funds sit unclaimed forever until received.

Deep protocol details — state-block anatomy, open/send/receive/change semantics, PoW thresholds, key/address derivations, representatives & ORV: [blocklattice](references/blocklattice.md)

### Changing Representative

```json
{ "name": "wallet_change_rep", "arguments": { "wallet": "my-wallet", "representative": "nano_..." } }
```
```bash
bunx -y xno-skills@4.7.4 change-rep --wallet "my-wallet" --representative "nano_..."
```

Full options: [change-rep](references/change-rep.md)

### Explorer Links

- Account: `https://blocklattice.io/account/<nano_address>`
- Block: `https://blocklattice.io/block/<UPPERCASE_HEX_HASH>`

---

## Configuration & Defaults

No configuration required: public RPC nodes, local-first WASM/GPU PoW with remote fallback, default representative, max send `1.0 XNO`. Config lives in a JSON file that reloads before every operation — overrides via `config_set` or `NANO_RPC_URL` / `NANO_WORK_URL` env vars take effect immediately, no restart.

Defaults, override precedence, set/reset semantics: [config](references/config.md)

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

`diag` does not make network calls. If `Local PoW Recommended` is `false` or PoW timing looks surprising, run `xno-skills rpc probe-caps <effective-work-url>` to verify remote `work_generate` support.

Recovery procedures — **"RPC request failed: All endpoints exhausted"**, **MCP crashes / "Not connected" errors**, **PoW failures (`POW_FAILED` / timeout)**: [troubleshooting](references/troubleshooting.md)

---

## Quick-Start Example

```
1. wallet_list: {}                    → discover "my-wallet" exists
2. wallet_balance: { wallet: "my-wallet" }    → check balance / pending
3. wallet_receive: { wallet: "my-wallet" }    → only if receipt was requested or pending funds are needed
4. wallet_send: { wallet: "my-wallet", destination: "nano_...", amountXno: "0.01" }
```
