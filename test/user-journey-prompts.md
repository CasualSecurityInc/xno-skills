# Nano MCP v3 User Journey Test — Agent Self-Discovery Checklist

Use these prompts one at a time in a fresh OpenCode session. The agent should use the `nano` skill and discover the correct MCP tool from descriptions alone. Do not hint at tool names.

After each prompt, verify:
- Did the skill activate? (Should reference xno-mcp tools)
- Did the agent call exactly one tool?
- Did the arguments match the schemas? (Correct param names, types, defaults)
- Was the response natural / not an error?

---

## Setup / Discovery

### 1. Wallet inventory
> What wallets do I have?

**Should trigger:** `wallet_list` — agent discovers wallets first before any operation.

### 2. Address lookup
> What's the Nano address for my wallet A?

**Should trigger:** `wallet_address` with wallet name resolved from context.

### 3. Health check
> Is the wallet signing daemon working?

**Should trigger:** `wallet_ows_health` — agent checks OWS reachability before trusting signing.

### 4. Read config
> What's the current server configuration?

**Should trigger:** `config_get` — agent reads RPC URLs, timeouts, limits.

### 5. Update config
> I want to raise my spending limit to 5 XNO.

**Should trigger:** `config_set` — agent updates maxSendXno.

---

## Reading State

### 6. Balance check
> Check the balance on wallet A. Tell me if there's anything pending too.

**Should trigger:** `wallet_balance` — agent fetches balance + pending blocks list.

### 7. Full account state
> Give me everything about wallet A — frontier, representative, balance, the works.

**Should trigger:** `wallet_info` — agent fetches full on-chain account summary.

### 8. Transaction history
> Show me the last 20 transactions for wallet A.

**Should trigger:** `wallet_history` — agent limits to 20 entries.

### 9. External balance query
> How much XNO does nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7 have?

**Should trigger:** `rpc_account_balance` — agent queries arbitrary address via RPC.

### 10. External account info
> Get the full account info for that same address.

**Should trigger:** `rpc_account_info` — frontier, representative, block count.

### 11. Pending blocks check
> Are there any pending receivable blocks for wallet A?

**Should trigger:** `rpc_receivable` — agent lists pending sends waiting to be claimed.

### 12. RPC capability probe
> Does the node I'm connected to support remote proof of work?

**Should trigger:** `rpc_probe_caps` — agent checks version, ledger-read, work_generate support.

---

## Utilities

### 13. Address validation (invalid)
> Is nano_1invalid a valid Nano address?

**Should trigger:** `util_validate` — agent returns invalid result with reason.

### 14. Unit conversion (XNO → raw)
> How much is 1.5 XNO in raw?

**Should trigger:** `util_convert` — amount 1.5, from xno, to raw.

### 15. Unit conversion (raw → mnano)
> Convert 1000000000000000000000000000 raw to mnano.

**Should trigger:** `util_convert` — from raw, to mnano.

### 16. QR generation
> Make me a QR code for wallet A's address.

**Should trigger:** `util_qr` — default ASCII format, no amount.

---

## Operations

### 17. Receive funds
> There should be pending funds for wallet A — receive them.

**Should trigger:** `wallet_receive` — agent auto-detects pending and pockets them.

### 18. Send funds
> Send 0.01 XNO from wallet A to nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7.

**Should trigger:** `wallet_send` — agent validates destination first, then sends.

### 19. Change representative
> Change the representative on wallet A to nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4.

**Should trigger:** `wallet_change_rep` — agent updates rep for wallet A.

---

## Expert / Block Building (unsigned)

### 20. Unsigned send block
> Build me an unsigned send block from wallet A's address to nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7 for 0.01 XNO. I want the hex.

**Should trigger:** `block_send` — agent returns unsigned hex only, no signing/broadcast.

### 21. Unsigned receive block
> Build an unsigned receive block hex for wallet A.

**Should trigger:** `block_receive` — auto-detects pending hash if none specified.

### 22. Unsigned change block
> Build an unsigned change representative block for wallet A to nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4.

**Should trigger:** `block_change` — requires account + representative params.

### 23. Submit prepared block
> Sign and submit this block hex I have using wallet A.

**Should trigger:** `wallet_submit_block` — agent signs via OWS and broadcasts.

---

## Payment Requests

### 24. Create invoice
> Create an invoice for 0.1 XNO for consulting work. Use wallet A.

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

**Should trigger:** `payment_refund` with `execute: false` first (dry run), then agent asks for confirmation address, then `execute: true` + `confirmAddress`.

---

## Pass Criteria

| # | Skill triggered? | Correct tool? | Valid args? | Clean response? |
|---|------------------|---------------|-------------|-----------------|
| 1 |                  |               |             |                 |
| 2 |                  |               |             |                 |
| ... |                |               |             |                 |

If any row fails, inspect:
1. **Skill triggers** — does the prompt contain a trigger keyword?
2. **Tool descriptions** — is the description clear enough for the model to route correctly?
3. **Parameter descriptions** — does the model know which params are required vs optional?
4. **Annotations** — is the model hesitant to call a write tool? (should not be — annotations signal safety)
