# sign-message

Sign an off-chain message (plain text) using a custodial wallet managed by `xno-mcp`. This follows the NOMS (Nano Off-chain Message Signature) / ORIS-001 standard.

## Usage

Use this skill when you need to prove ownership of a Nano account or provide an off-chain signature for authentication, voting, or other non-transactional proofs.

### Prerequisites

- A custodial wallet must be created or imported in `xno-mcp` (e.g., using `wallet_create`).

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

## NOMS Standard (ORIS-001)

The signature is computed over a binary payload that includes a magic header, ensuring it cannot be misinterpreted as a valid Nano block. This protects users from accidentally signing a malicious transaction block.
