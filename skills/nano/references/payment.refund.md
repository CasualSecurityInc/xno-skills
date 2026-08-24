# payment_refund (MCP tool)

Return funds from a tracked payment request to the original payer.

## Step 1 — Dry run (default)

```json
{ "name": "payment_refund", "arguments": { "id": "<request-id>", "execute": false } }
```

Evaluates the refund destination without sending anything. Never guess the refund destination — always confirm with the operator, showing the **full address** (never abbreviate).

## Step 2 — Execute after confirmation

```json
{ "name": "payment_refund", "arguments": { "id": "<request-id>", "execute": true, "confirmAddress": "nano_..." } }
```

`confirmAddress` must match the original source address.

**Edge cases:**
- Spending limit blocks the refund: report the current `maxSendXno` limit and ask whether the human/operator wants it changed. Never raise it unless explicitly requested.
- Not linked to a payment request: use `wallet_send` directly after confirming destination and amount with the operator.

Gated by `maxSendXno` like every send.
