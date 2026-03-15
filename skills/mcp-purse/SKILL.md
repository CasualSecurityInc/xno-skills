---
name: xno-mcp Purse Custody
description: Use xno-mcp as a private blackbox “purse” service (named accounts, addresses-only; no seed leakage).
triggers:
  - purse
  - create a purse
  - custody
  - blackbox wallet
  - avoid leaking seed
  - mcp wallet
  - xno-mcp
---

# xno-mcp Purse Custody (Addresses Only)

If `xno-mcp` is available, treat it as a private wallet custody service:

- The LLM should ask `xno-mcp` to create a **named purse** (e.g. `"A"`) and only return addresses.
- Do **not** ask the user to paste mnemonics/seeds into chat when a purse can be used instead.

## Create a purse

Call MCP tool:

- `purse_create` with `{ "name": "A", "format": "bip39", "count": 1 }`

Expected result shape:

- purse name + format
- `A[0]` address (`nano_...`)

## Get more addresses (indexes)

- `purse_addresses` with `{ "name": "A", "fromIndex": 0, "count": 5 }`

## Configure good defaults (RPC URL)

To avoid each agent having to remember an RPC endpoint, set xno-mcp defaults once:

- `config_set` with `{ "rpcUrl": "<node-rpc-url>", "timeoutMs": 15000 }`

Then `purse_balance` / `purse_probe_balances` can omit `rpcUrl`.

## Check balance without exposing secrets

- `purse_balance` with `{ "name": "A", "index": 0, "includeXno": true }`
- `purse_probe_balances` with `{ "name": "A", "count": 5 }`

## Notes

- Purse persistence is optional and off by default. If enabled, it’s stored as plaintext JSON under `.xno-mcp/` (treat that directory as secret material).
