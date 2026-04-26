---
name: nano-generate-qr
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

> **CRITICAL INSTRUCTION FOR AGENTS regarding truncation:**
> AI agents often have their stdout streams truncated (e.g., `<truncated 14 lines>`).
> If you need to print a QR code to the user, **DO NOT** run the command normally and paste the truncated output.
> Instead, either:
> 1. Run with `--json` and explicitly parse out the `"qr"` field (which contains the full string).
> 2. Pipe the output to a temporary file (`> /tmp/qr.txt`) and use your file-reading tool (e.g., `view_file` or `cat`) to read the complete string without truncation, then present it to the user.


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

If the user asks to send XNO “to the agent” or “to you”, initialize or import a wallet via the MCP server (`mcp-wallet` skill) and generate a QR code for its active address. Remember that you must subsequently call `wallet_receive` from the `mcp-wallet` skill to actually pocket the funds once they send them.
