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

# sign-message

Sign an off-chain message (plain text) using a custodial wallet managed by `xno-mcp`. This follows the NOMS (Nano Off-chain Message Signature) / ORIS-001 standard.

## Usage

Use this skill when you need to prove ownership of a Nano account or provide an off-chain signature for authentication, voting, or other non-transactional proofs.

### Prerequisites

- A custodial wallet must be created in OWS (e.g., using `ows wallet create`) and visible in `xno-mcp` via `wallet_list`.

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
npx xno-skills sign "<message>" --key <private-key-hex>
```

### Example

```bash
npx xno-skills sign "I am me." --key 0000000000000000000000000000000000000000000000000000000000000000
```

To get JSON output:

```bash
npx xno-skills sign "I am me." --key 0000000000000000000000000000000000000000000000000000000000000000 --json
```

## NOMS Standard (ORIS-001)

The signature is computed over a binary payload that includes a magic header, ensuring it cannot be misinterpreted as a valid Nano block. This protects users from accidentally signing a malicious transaction block.
