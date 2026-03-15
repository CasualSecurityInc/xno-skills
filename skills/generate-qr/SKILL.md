---
name: Generate Nano QR Code
description: Generate an ASCII QR code for a Nano address (optionally with an amount).
triggers:
  - qr code
  - generate qr
  - nano qr
  - xno qr
  - payment qr
  - top up
  - top-up
  - fund wallet
  - request payment
  - request top up
  - donation
  - tip jar
  - request payment
  - xno-skills qr
---

# Generate Nano QR Code

Generates a terminal-friendly ASCII QR code for a Nano address, optionally including an amount.

## CLI Usage

### Basic QR (address only)

```bash
npx -y xno-skills qr nano_1abc123...
```

### QR with amount (in XNO, decimal)

```bash
npx -y xno-skills qr nano_1abc123... --amount 1.5
```

### JSON output (for scripts)

```bash
npx -y xno-skills qr nano_1abc123... --amount 1.5 --json
```

Returns:

- `content`: the canonical `nano:` URI (`nano:<address>?amount=<raw>`)
- `qr`: the ASCII QR block

## Notes

- The CLI validates the address before generating the QR.
- The `--amount` value is interpreted as XNO (Nano), not raw.

## Top-Up Requests

Use this when the **user** needs to receive XNO (fund their own wallet):

- If they want an easy “fund this address” QR, generate an address-only QR.
- If the user wants a specific amount, generate a QR with `--amount`; the resulting `nano:` URI includes the raw amount parameter.

In interactive flows, ask for:

- The receiving address (or confirm it).
- Optional amount in XNO.

If the user asks to send XNO “to the agent / to you”, respond that the agent can’t receive funds, and pivot to helping them generate/validate a wallet **they** control.
