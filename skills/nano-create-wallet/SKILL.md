---
name: nano-create-wallet
description: "Create or restore a Nano (XNO) wallet via Open Wallet Standard (OWS). For secure custody, rely on the unified OWS framework."
triggers:
  - create wallet
  - generate wallet
  - new wallet
  - wallet create
  - ows wallet
  - create ows wallet
  - nano wallet
  - cryptocurrency wallet
  - generate seed
  - generate mnemonic
  - new seed
---

# Create / Restore a Nano (XNO) Wallet (via OWS)

Nano wallet management is delegated to the **Open Wallet Standard (OWS)**. This provides a unified, policy-gated vault for all agent keys.

## Assistant guardrails (match user intent)

If a user says "I want to send you XNO" or "can you receive it?":

- The agent **can** accept funds! You should use the `ows` CLI to create a wallet or rely on an existing OWS wallet.
- Once you have an OWS wallet name (e.g., `"agent-vault"`), use `wallet_list` to see your addresses and provide one to the user.
- **Never** paste seeds or mnemonics into chat.

If the agent has access to **OWS**:

- Always prefer OWS for custody. It keeps secrets encrypted at rest and allows for standardized signing across different tools.
- Create a named wallet: `ows wallet create --name "my-agent"`

## CLI usage (via OWS)

### Create a new OWS wallet

```bash
# This derives addresses for all supported chains, including Nano
ows wallet create --name "my-wallet"
```

### Import an existing mnemonic into OWS

```bash
# Follow the interactive prompt to enter the mnemonic securely
ows wallet import --name "imported-vault"
```

## Integrating with xno-skills

While OWS handles the **keys**, `xno-skills` handles the **Nano network**. 

1.  **Creation**: Use `ows wallet create`.
2.  **Discovery**: Use `wallet_list` (in `xno-mcp`) to see your OWS wallets and Nano addresses.
3.  **Sending/Receiving**: Use `wallet_send` and `wallet_receive` (in `xno-mcp`). These tools will automatically bridge your OWS wallet with the Nano RPC to construct and publish blocks.

## "Receive" expectations

Nano funds show as **pending** until the recipient publishes a receive block. 

**After an operator sends funds, you MUST call `wallet_receive` or `payment_request_receive` to pocket the funds.**

## Related skills

- `nano-mcp-wallet` – Use OWS wallets via the `xno-mcp` service (recommended for agents)
- `nano-generate-qr` – Make a QR for the address
- `nano-validate-address` – Verify a Nano address before sending
- `nano-check-balance` – Verify balance/pending via RPC
