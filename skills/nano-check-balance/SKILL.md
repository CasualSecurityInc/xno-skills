---
name: nano-check-balance
description: "Check a Nano account's balance and pending amount. You can check YOUR wallet's balance (via wallet_balance/wallet_probe_balances) or any address (via rpc_account_balance)."
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
  - how much
  - what's the balance
  - funds arrived
  - did it arrive
  - have you got
  - got the funds
---

# Check XNO Balance (RPC)

When a user asks "did you receive it?" / "check the balance", you need an on-chain data source. This skill queries a **Nano node RPC** (user-provided) for `balance` and `pending` (both in raw).

## Important nuance: pending vs received

Nano can show funds as **pending** until the receiving wallet publishes the receive/open block. Many wallet apps do this automatically; raw keys alone do not.

**If you see pending funds, you must call `wallet_receive` to pocket them.**

## Well-known Public RPC Nodes

If the user doesn't have an RPC URL, suggest these public nodes:
- `https://rpc.nano.org` (Nano Foundation)
- `https://app.natrium.io/api/rpc` (Natrium)
- `https://nanonode.cc/api` (NanoNode.cc)
- `https://node.somenano.site/api` (SomeNano)

## CLI usage (`xno-skills`)

Check balance using built-in public zero-config nodes:

```bash
npx -y xno-skills rpc account-balance <address> --json --xno
```

Or pass a specific node URL explicitly if the user provides one:

```bash
npx -y xno-skills rpc account-balance <address> --url "https://rpc.nano.org" --json --xno
```

## MCP usage (`xno-mcp`)

If the agent has access to the `xno-mcp` tools:

**Check balance (zero-config, works automatically):**
- `rpc_account_balance` with `{ "address": "..." }`
- `wallet_balance` with `{ "name": "my-wallet", "index": 0 }`

You may optionally specify an RPC node if the built-in defaults are insufficient:
- `config_set: { "rpcUrl": "https://rpc.nano.org" }`
- `rpc_account_balance` with `{ "address": "...", "rpcUrl": "..." }`

**If you see pending funds, receive them:**
- `wallet_receive` with `{ "name": "my-wallet", "index": 0 }`

## Fallback (no network available)

If the environment has no network access at all, ask them to check the address in a block explorer or in their wallet app and report back:

- confirmed on-chain balance
- pending/receivable amount (if shown)