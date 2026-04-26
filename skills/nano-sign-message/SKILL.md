---
name: nano-sign-message
description: Sign an off-chain message (plain text) using a custodial wallet managed by xno-mcp. Following NOMS (Nano Off-chain Message Signature) / ORIS-001.
triggers:
  - sign message
  - off-chain signature
  - prove ownership
  - message signing
  - sign text
  - noms signature
---

# nano-sign-message

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

Sign an off-chain message (plain text) using a custodial wallet managed by `xno-mcp`. This follows the NOMS (Nano Off-chain Message Signature) / ORIS-001 standard.

## Usage

Use this skill when you need to prove ownership of a Nano account or provide an off-chain signature for authentication, voting, or other non-transactional proofs.

### Prerequisites

- A custodial wallet must be created in OWS (e.g., using `bunx -y ows wallet create`) and visible in `xno-mcp` via `wallet_list`.

### Sign a message

To sign a message, call the `sign_message` tool:

```json
{
  "name": "sign_message",
  "arguments": {
    "name": "my-wallet",
    "index": 0,
    "message": "I am me."
  }
}
```

The tool will return the address, public key, and the hex-encoded signature.

## CLI Usage

You can also sign messages directly from the command line if you have the private key:

```bash
bunx -y xno-skills sign "<message>" --key <private-key-hex>
```

### Example

```bash
bunx -y xno-skills sign "I am me." --key 0000000000000000000000000000000000000000000000000000000000000000
```

To get JSON output:

```bash
bunx -y xno-skills sign "I am me." --key 0000000000000000000000000000000000000000000000000000000000000000 --json
```

## NOMS Standard (ORIS-001)

The signature is computed over a binary payload that includes a magic header, ensuring it cannot be misinterpreted as a valid Nano block. This protects users from accidentally signing a malicious transaction block.
