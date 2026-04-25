---
name: return-funds
description: Return XNO to the operator or original sender. Identifies source addresses, confirms before sending, handles ambiguity safely.
triggers:
  - return funds
  - send back
  - refund
  - return xno
  - return nano
  - give back
  - send it back
  - return the money
  - return payment
---

# Return Funds to Sender

When the operator asks you to return funds (e.g., "send it back", "return the XNO", "refund"), follow this workflow carefully.

## Core Safety Rule

**NEVER guess the refund destination.** If there is any ambiguity about where to send funds, ALWAYS ask the operator to confirm.

## Workflow

### Step 1: Identify what to return

If the request is linked to a payment request:
1. Call `payment_request_refund` with the request ID and `execute: false`
2. This returns source addresses from received blocks

If no payment request exists:
1. Call `wallet_history` to see recent transactions
2. Identify receive transactions and their source addresses

### Step 2: Evaluate ambiguity

The system will tell you if the refund target is clear or ambiguous:

**Single source (clear):**
- One address sent all the funds
- Present the address and amount to the operator for confirmation
- Example: "I received 0.1 XNO from `nano_1abc...`. Shall I return it there?"

**Multiple sources (ambiguous):**
- Different addresses sent funds
- List ALL candidates with amounts
- Ask the operator which address to refund to
- Example: "I received funds from multiple addresses:
  1. `nano_1abc...` — 0.05 XNO
  2. `nano_3def...` — 0.05 XNO
  Which address should I return funds to?"

**No sources found:**
- No received funds to return
- Tell the operator: "No incoming transactions found to refund."

### Step 3: Confirm and execute

After the operator confirms the destination:
1. Call `payment_request_refund` with `execute: true` and `confirmAddress: "<confirmed address>"`
2. Or use `wallet_send` directly if not linked to a payment request
3. Report the send hash and updated balance

## Important Rules

- **Always confirm before sending** — even if there's only one source
- **Show the full address** — don't abbreviate, let the operator verify
- **If the operator says "send it back" without context**, check `payment_request_list` for recent requests, then `wallet_history` for recent receives
- **Partial refunds are OK** — if the operator asks to return only part of the funds, respect that
- **Check allowance limits** — if spending limits are set, the refund may need operator approval to increase limits first
- **Log everything** — all refund operations are tracked in transaction history

## Edge Cases

### "Return everything"
1. Check total balance across all wallet accounts
2. List all accounts with balances
3. Confirm with operator before draining accounts

### "Return to [specific address]"
1. Validate the address first (`validate_address`)
2. Confirm amount
3. Send directly — no need to match against sources

### Allowance blocks the refund
If spending limits prevent the refund:
- Tell the operator: "The current spending limit prevents this send. Please increase the limit via `config_set({ maxSendXno: \"...\" })` or confirm you'd like to proceed."

## Related Skills

- `request-payment` — the inbound counterpart
- `mcp-wallet` — wallet operations
- `validate-address` — verify addresses before sending
