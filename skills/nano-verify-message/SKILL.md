---
name: nano-verify-message
description: Verify an off-chain message signature (NOMS / ORIS-001 standard) against a Nano address or public key.
triggers:
  - verify message
  - check signature
  - verify signature
  - signature verification
  - noms verification
  - is this signature valid
---

# nano-verify-message

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

Verify an off-chain message signature (NOMS / ORIS-001 standard) against a Nano address or public key.

## Usage

Use this skill when you are presented with a signature and a message from a user or another agent and need to verify their identity or the integrity of the message.

### Verify a signature

To verify a signature, call the `verify_message` tool:

```json
{
  "name": "verify_message",
  "arguments": {
    "address": "nano_1hfrig58wzrg4pzqen17cyannpy1173oi7jz7zd6srjsqjh7ozcgec9uyo9n",
    "message": "I am me.",
    "signature": "3de8620fb30967916d3dc36cd09eba9a633d1678b986fbc31b70ae2834db25a898085bbce32b744aef42ed56b5c001ffebd5516e78c9f22c678dde2d8bdc150a"
  }
}
```

The tool will return `{ "valid": true }` if the signature is correct.

## CLI Usage

You can also verify signatures directly from the command line:

```bash
bunx -y xno-skills verify <address> "<message>" <signature>
```

### Example

```bash
bunx -y xno-skills verify nano_1hfrig58wzrg4pzqen17cyannpy1173oi7jz7zd6srjsqjh7ozcgec9uyo9n "I am me." 3de8620fb30967916d3dc36cd09eba9a633d1678b986fbc31b70ae2834db25a898085bbce32b744aef42ed56b5c001ffebd5516e78c9f22c678dde2d8bdc150a
```

To get JSON output for integration:

```bash
bunx -y xno-skills verify nano_1hfrig58wzrg4pzqen17cyannpy1173oi7jz7zd6srjsqjh7ozcgec9uyo9n "I am me." 3de8620fb30967916d3dc36cd09eba9a633d1678b986fbc31b70ae2834db25a898085bbce32b744aef42ed56b5c001ffebd5516e78c9f22c678dde2d8bdc150a --json
```

## NOMS Standard (ORIS-001)

This verification tool handles the binary payload construction and hashing internally according to the ORIS-001 specification. It supports both `nano_` / `xrb_` addresses and raw 32-byte hex public keys.
