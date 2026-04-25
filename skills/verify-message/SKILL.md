---
name: verify-message
description: Verify an off-chain message signature (NOMS / ORIS-001 standard) against a Nano address or public key.
triggers:
  - verify message
  - check signature
  - verify signature
  - signature verification
  - noms verification
  - is this signature valid
---

# verify-message

Verify an off-chain message signature (NOMS / ORIS-001 standard) against a Nano address or public key.

## Usage

Use this skill when you are presented with a signature and a message from a user or another agent and need to verify their identity or the integrity of the message.

### Verify a signature

To verify a signature, call the `verify_message` tool:

```json
{
  "name": "verify_message",
  "arguments": {
    "address": "nano_1qmbhidbruqqg85rqu9nhd178uo46oocons95ukgaoesp97aes511rrotf3b",
    "message": "I am me.",
    "signature": "3de8620fb30967916d3dc36cd09eba9a633d1678b986fbc31b70ae2834db25a898085bbce32b744aef42ed56b5c001ffebd5516e78c9f22c678dde2d8bdc150a"
  }
}
```

The tool will return `{ "valid": true }` if the signature is correct.

## NOMS Standard (ORIS-001)

This verification tool handles the binary payload construction and hashing internally according to the ORIS-001 specification. It supports both `nano_` / `xrb_` addresses and raw 32-byte hex public keys.
