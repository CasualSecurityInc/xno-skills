---
name: Check XNO Balance (RPC)
description: Check a Nano account’s balance and pending amount via a Nano node RPC URL.
triggers:
  - check balance
  - account balance
  - did you receive
  - received it
  - pending
  - confirm payment
  - nano rpc
  - xno rpc
  - account_info
  - account_balance
---

# Check XNO Balance (RPC)

When a user asks “did you receive it?” / “check the balance”, you need an on-chain data source. This skill queries a **Nano node RPC** (user-provided) for `balance` and `pending` (both in raw).

## Important nuance: pending vs received

Nano can show funds as **pending** until the receiving wallet publishes the receive/open block. Many wallet apps do this automatically; raw keys alone do not.

## CLI usage (`xno-skills`)

Set an RPC URL (recommended):

```bash
export NANO_RPC_URL="http://127.0.0.1:7076"
```

Then:

```bash
npx -y xno-skills rpc account-balance <address> --json --xno
```

Or pass the URL explicitly:

```bash
npx -y xno-skills rpc account-balance <address> --url "<rpc-url>" --json --xno
```

If the user has a mnemonic and isn’t sure whether it’s **bip39** or **legacy** (common with 24-word phrases), prefer:

```bash
# Don’t paste mnemonics into chat; run locally and use stdin
npx -y xno-skills wallet probe-mnemonic --stdin --url "<rpc-url>" --json
```

## MCP usage (`xno-mcp`)

If the agent has access to the `xno-mcp` tools, call:

- `rpc_account_balance` with `{ "address": "...", "rpcUrl": "...", "includeXno": true }`
- If you’re using an `xno-mcp` **purse**, prefer `purse_balance` / `purse_probe_balances` so the LLM never needs to handle secrets.

## Fallback (no RPC available)

If the user can’t provide an RPC URL (or the environment has no network access), ask them to check the address in a block explorer or in their wallet app and report back:

- confirmed on-chain balance
- pending/receivable amount (if shown)
