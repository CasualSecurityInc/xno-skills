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

> **CLI Execution Priority**: Do not assume `xno-skills` is installed globally. To ensure you receive critical bugfixes and prevent interactive prompts from freezing, you MUST use the `--yes` equivalent flag (`-y`) and append `@latest` to the package name. Always use the following order of priority:
> 1. `bunx -y xno-skills@latest <command>`
> 2. `pnpm dlx xno-skills@latest <command>`
> 3. `npx -y xno-skills@latest <command>`
>
> For Nano actions, prefer MCP tools first, then `xno-skills` CLI verbs. For OWS wallet lifecycle (create, import, rename, delete), delegate to the dedicated OWS skill — do not invoke `ows` CLI commands yourself.
>
> *Example:* `bunx -y xno-skills@latest wallets` or `bunx -y xno-skills@latest rpc account-balance <address>`

> **Safety & Best Practices**:
> - **State Verification:** Always verify an account's state (balance and frontier) via RPC before manually building a block. Do not hallucinate previous hashes.
> - **Command Discovery:** Always use `--help` (e.g., `bunx -y xno-skills --help`) before guessing CLI subcommands to avoid 'unknown command' errors.
> - **Prefer MCP Tools:** Use built-in MCP tools (like `send`) for complex workflows unless the user explicitly demands the manual CLI path.
> - **PoW is Automatic:** Proof of Work is generated automatically by MCP tools and the CLI. Never attempt to generate or supply PoW manually.
> - **Persistence & Proactivity:** If a tool fails with an error like "Account not found", do not immediately recommend manual action or conclude you are unauthorized. Troubleshoot the protocol state (e.g., check for pending funds) and use the correct tool for that state (e.g., `receive` to open an account).
> - **No Custom Scripts:** NEVER write custom Node.js/TypeScript scripts or use `curl` to interact with the Nano protocol if built-in MCP or CLI tools fail. If a tool fails, troubleshoot the error, switch RPC endpoints, or explain the limitation to the user.
> - **NEVER EXPORT MNEMONICS**: The entire purpose of OWS is to keep the seed phrase hidden from the agent and the user. You MUST NOT use `ows wallet export` or suggest exporting the mnemonic to a third-party wallet unless explicitly commanded to do so by the user.
> - **Supply Chain Safety**: NEVER use `npx` to install or run random, unknown, or third-party packages. Only use the approved tools provided in this project (`xno-skills@latest` and `@open-wallet-standard/core`). If a task cannot be performed with these tools, do not seek external npm packages as a workaround.

Generates a terminal-friendly ASCII QR code for a Nano address, optionally including an amount.

## CLI Usage

### Basic QR (address only)

```bash
bunx -y xno-skills qr nano_1abc123...
```

### QR with amount (in XNO, decimal)

```bash
bunx -y xno-skills qr nano_1abc123... --amount-xno 1.5
```

### JSON output (for scripts)

```bash
bunx -y xno-skills qr nano_1abc123... --amount-xno 1.5 --json
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
- The `--amount-xno` value is interpreted as XNO (Nano), not raw.

## Top-Up Requests

Use this when the **user** needs to receive XNO (fund their own wallet):

- If they want an easy “fund this address” QR, generate an address-only QR.
- If the user wants a specific amount, generate a QR with `--amount-xno`; the resulting `nano:` URI includes the raw amount parameter.

In interactive flows, ask for:

- The receiving address (or confirm it).
- Optional amount in XNO.

If the user asks to send XNO "to the agent" or "to you", first ensure a wallet exists by delegating to the separate OWS skill (for creation/import), then use `wallets` via the `nano-mcp-wallet` skill to discover the Nano address and generate a QR code for it. Subsequently call `receive` from the `nano-mcp-wallet` skill to pocket the funds once they are sent.
