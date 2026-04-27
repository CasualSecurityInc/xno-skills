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

> **CLI Execution Priority**: Do not assume `xno-skills` or `ows` are installed globally. When executing CLI commands, always use the following order of priority to ensure successful execution:
> 1. `bunx -y <command>`
> 2. `pnpm dlx <command>`
> 3. `npx -y <command>`
> 
> *Example:* `bunx -y ows wallet list` or `bunx -y xno-skills rpc account-balance <address>`

> **Safety & Best Practices**:
> - **State Verification:** Always verify an account's state (balance and frontier) via RPC before manually building a block. Do not hallucinate previous hashes.
> - **Command Discovery:** Always use `--help` (e.g., `bunx -y xno-skills --help`) before guessing CLI subcommands to avoid 'unknown command' errors.
> - **Prefer MCP Tools:** Use built-in MCP tools (like `wallet_send`) for complex workflows unless the user explicitly demands the "raw" manual CLI path.
> - **PoW Validation:** Remember that a signed block without valid Proof of Work (PoW) cannot be broadcast. Ensure PoW is generated.
> - **Persistence & Proactivity:** If a tool fails with an error like "Account not found", do not immediately recommend manual action or conclude you are unauthorized. Troubleshoot the protocol state (e.g., check for pending funds) and use the correct tool for that state (e.g., `wallet_receive` to open an account).
> - **No Custom Scripts:** NEVER write custom Node.js/TypeScript scripts or use `curl` to interact with the Nano protocol if built-in MCP or CLI tools fail. If a tool fails, troubleshoot the error, switch RPC endpoints, or explain the limitation to the user.
> - **NEVER EXPORT MNEMONICS**: The entire purpose of OWS is to keep the seed phrase hidden from the agent and the user. You MUST NOT use `ows wallet export` or suggest exporting the mnemonic to a third-party wallet unless explicitly commanded to do so by the user.

Generates a terminal-friendly ASCII QR code for a Nano address, optionally including an amount.

## CLI Usage

### Basic QR (address only)

```bash
bunx -y xno-skills qr nano_1abc123...
```

### QR with amount (in XNO, decimal)

```bash
bunx -y xno-skills qr nano_1abc123... --amount 1.5
```

### JSON output (for scripts)

```bash
bunx -y xno-skills qr nano_1abc123... --amount 1.5 --json
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

If the user asks to send XNO “to the agent” or “to you”, initialize or import a wallet via the MCP server (`nano-mcp-wallet` skill) and generate a QR code for its active address. Remember that you must subsequently call `wallet_receive` from the `nano-mcp-wallet` skill to actually pocket the funds once they send them.
