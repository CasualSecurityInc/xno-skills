# Nano MCP Tool-Routing Checklist

Manual, offline checklist for a **fresh** agent session that has the `nano` skill and the `xno-mcp` tools loaded. It checks the two things the automated harness does not: that the skill activates on ordinary wording, and that the agent routes each of the 28 MCP tools correctly from tool descriptions alone.

Scope and usage:

- Run **one prompt at a time** in a fresh agent session (OpenCode, Codex, or any MCP-capable client). **Withhold this file from the agent** — the point is discovery, not recall.
- Replace `<wallet>` with any wallet name returned by `wallet_list`.
- This checklist is **not** part of CI or the release flow.
- It is not the end-to-end journey test. For the outcome-verified journey (create a wallet, send half the source balance, receive it — verified on-chain through a guard RPC), use `npm run eval:opencode-wallet-journey` or `npm run eval:codex-wallet-journey` (see README, "Opt-in Codex wallet journey evaluation"). For the binary Autoresearch rubric, see `skill-eval-guide.md`.
- Per-tool options: `skills/nano/references/*.md`.

After each prompt, verify:

- Did the skill activate? (Should reference `xno-mcp` tools.)
- Did the agent call exactly one tool?
- Did the arguments match the schemas? (Correct param names, types, defaults.)
- Was the response natural / not an error?

---

## Setup / Discovery

### 1. Wallet inventory

> What wallets do I have?

**Should trigger:** `wallet_list` — agent discovers wallets first before any operation.

### 2. Address lookup

> What's the Nano address for `<wallet>`?

**Should trigger:** `wallet_address` with the wallet name resolved from context.

### 3. Health check

> Is the wallet signing daemon working?

**Should trigger:** `wallet_ows_health` — agent checks OWS reachability before trusting signing.

### 4. Diagnostics

> What version of the toolkit and OWS is running, and is mock mode on?

**Should trigger:** `system_diag` — reports versions, paths, invocation, and environment (no network).

---

## Configuration

### 5. Read config

> What's the current server configuration?

**Should trigger:** `config_get` — agent reads RPC URLs, timeouts, limits.

### 6. Update config

> I want to raise my spending limit to 5 XNO.

**Should trigger:** `config_set` — agent updates `maxSendXno`.

---

## Reading State

### 7. Balance check

> Check the balance on `<wallet>`. Tell me if there's anything pending too.

**Should trigger:** `wallet_balance` — agent fetches balance + pending blocks list.

### 8. Full account state

> Give me everything about `<wallet>` — frontier, representative, balance, the works.

**Should trigger:** `wallet_info` — agent fetches the full on-chain account summary.

### 9. Transaction history

> Show me the last 20 transactions for `<wallet>`.

**Should trigger:** `wallet_history` — agent limits to 20 entries.

### 10. External balance query

> How much XNO does nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7 have?

**Should trigger:** `rpc_account_balance` — agent queries an arbitrary address via RPC.

### 11. External account info

> Get the full account info for that same address.

**Should trigger:** `rpc_account_info` — frontier, representative, block count.

### 12. Pending blocks check

> Are there any pending receivable blocks for `<wallet>`?

**Should trigger:** `rpc_receivable` — agent lists pending sends waiting to be claimed.

### 13. RPC capability probe

> Does the node I'm connected to support remote proof of work?

**Should trigger:** `rpc_probe_caps` — agent checks version, ledger-read, work_generate support.

---

## Utilities

### 14. Address validation (invalid)

> Is nano_1invalid a valid Nano address?

**Should trigger:** `util_validate` — agent returns an invalid result with reason.

### 15. Unit conversion (XNO → raw)

> How much is 1.5 XNO in raw?

**Should trigger:** `util_convert` — amount 1.5, from xno, to raw.

### 16. QR generation

> Make me a QR code for `<wallet>`'s address.

**Should trigger:** `util_qr` — default ASCII format, no amount.

---

## Operations

### 17. Receive funds

> There should be pending funds for `<wallet>` — receive them.

**Should trigger:** `wallet_receive` — agent auto-detects pending and pockets them.

### 18. Send funds

> Send 0.01 XNO from `<wallet>` to nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7.

**Should trigger:** `wallet_send` — agent validates the destination first, then sends.

### 19. Change representative

> Change the representative on `<wallet>` to nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4.

**Should trigger:** `wallet_change_rep` — agent updates the rep for `<wallet>`.

---

## Expert / Block Building (unsigned)

### 20. Unsigned send block

> Build me an unsigned send block from `<wallet>`'s address to nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7 for 0.01 XNO. I want the hex.

**Should trigger:** `block_send` — agent returns unsigned hex only, no signing/broadcast.

### 21. Unsigned receive block

> Build an unsigned receive block hex for `<wallet>`.

**Should trigger:** `block_receive` — auto-detects the pending hash if none specified.

### 22. Unsigned change block

> Build an unsigned change representative block for `<wallet>` to nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4.

**Should trigger:** `block_change` — requires account + representative params.

### 23. Submit prepared block

> Sign and submit this block hex I have using `<wallet>`.

**Should trigger:** `wallet_submit_block` — agent signs via OWS and broadcasts.

---

## Payment Requests

### 24. Create invoice

> Create an invoice for 0.1 XNO for consulting work. Use `<wallet>`.

**Should trigger:** `payment_create` — returns request ID + QR + address.

### 25. List invoices

> Show me all my payment requests.

**Should trigger:** `payment_list` — agent filters nothing, returns all.

### 26. Check invoice status

> What's the status of that invoice I just created?

**Should trigger:** `payment_status` — agent must remember/pass the ID from step 24.

### 27. Receive invoice payment

> The client says they paid the invoice. Receive the funds.

**Should trigger:** `payment_receive` — agent receives for the payment request ID.

### 28. Refund invoice

> The client wants a refund for that invoice.

**Should trigger:** `payment_refund` with `execute: false` first (dry run), then agent asks for the confirmation address, then `execute: true` + `confirmAddress`.

---

## Pass Criteria

| #   | Skill triggered? | Correct tool? | Valid args? | Clean response? |
| --- | ---------------- | ------------- | ----------- | --------------- |
| 1   |                  |               |             |                 |
| 2   |                  |               |             |                 |
| ... |                  |               |             |                 |

Coverage: the 28 prompts above correspond one-to-one with the 28 MCP tools.

If any row fails, inspect:

1. **Skill triggers** — does the prompt contain a trigger keyword?
2. **Tool descriptions** — is the description clear enough for the model to route correctly?
3. **Parameter descriptions** — does the model know which params are required vs optional?
4. **Annotations** — is the model hesitant to call a write tool? (It should not be — annotations signal safety.)
