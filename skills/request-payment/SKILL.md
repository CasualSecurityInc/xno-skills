---
name: request-payment
description: Request XNO from the operator. Creates a payment request, presents address/QR, watches for funds, receives them, and reports back.
triggers:
  - request payment
  - request funds
  - need xno
  - need nano
  - fund me
  - send me xno
  - send me nano
  - top up
  - allowance
  - I need money
  - payment request
  - request allowance
  - ask for funds
---

# Request Payment from Operator

When you need XNO (e.g., for testing, for a task that requires funds, or because the operator offered), follow this workflow.

## Workflow

### Step 1: Check existing wallets

Before creating anything new, check what you already have:

1. Call `wallet_list` to see existing wallets
2. If wallets exist, call `wallet_probe_balances` on each to check for existing funds
3. If an existing wallet has sufficient funds, skip to reporting — no request needed

### Step 2: Create a payment request

Call `payment_request_create`:
- `amountXno`: the amount needed (be specific)
- `reason`: why you need the funds (be clear — the operator sees this)
- `walletName`: optional — reuse an existing wallet, or omit to auto-select/create

This returns:
- A `nano:` URI (shareable/QR-ready)
- The target address
- A request ID for tracking

### Step 3: Present to the operator

Tell the operator:
- How much you need and why
- The `nano:` address to send to
- Offer to generate a QR code (use `generate-qr` skill or the `generate_qr` MCP tool if available)

Example message:
> I need 0.1 XNO for [reason]. Please send to:
> `nano_1abc...`
> Or scan this QR: [generate QR]

### Step 4: Wait and check for funds

After the operator says they've sent funds (or after a reasonable wait):

1. Call `payment_request_receive` with the request ID
2. This checks for pending blocks and receives them
3. Returns updated status: `pending`, `partial`, `funded`, or `received`

If status is `partial`, tell the operator how much more is needed.

### Step 5: Report back

Once funds are received, confirm to the operator:
- Amount received
- Updated balance
- That the funds are ready to use

## Important Rules

- **Always check existing wallets first** — don't create unnecessary wallets
- **Be specific about amounts and reasons** — vague requests erode trust
- **Never claim funds were received without calling `payment_request_receive`** — pending is not received in Nano
- **If the operator asks "did you get it?", always re-check** — call `payment_request_status` or `payment_request_receive`

## Related Skills

- `mcp-wallet` — wallet custody operations
- `check-balance` — manual balance checking
- `generate-qr` — QR code generation for payment addresses
- `return-funds` — returning funds to the operator
