---
name: mcp-wallet
description: Use xno-mcp as a private blackbox wallet service to securely custody keys, send/receive Nano, and manage accounts.
triggers:
  - purse
  - wallet
  - create a wallet
  - custody
  - blackbox wallet
  - avoid leaking seed
  - mcp wallet
  - xno-mcp
  - send nano
  - receive nano
  - pay
  - send funds
  - receive funds
  - pay me
  - invoice
  - receive block
  - open account
---

# xno-mcp Wallet Custody

If `xno-mcp` is available, treat it as a private wallet custody service. The agent **CAN** send and receive Nano using this MCP server securely.

- The LLM should ask `xno-mcp` to create a **named wallet** (e.g. `"A"`) and only return addresses.
- Do **not** ask the user to paste mnemonics/seeds into chat when the MCP can be used instead.

## Prerequisites: RPC URL and Representative

Before using wallet operations that require network access, you need:

1. **RPC URL** - A Nano node RPC endpoint. Well-known public nodes:
   - `https://rpc.nano.org` (Nano Foundation)
   - `https://app.natrium.io/api/rpc` (Natrium)
   - `https://nanonode.cc/api` (NanoNode.cc)
   - `https://node.somenano.site/api` (SomeNano)

2. **Representative** - Required for opening new accounts. Well-known representatives:
   - `nano_1iuz18nxc4am6i4ixn7enj9tusyz8c3nyohmm77bzzd95sx9xmr9xh9qg9b` (Nano Foundation)
   - `nano_3arg4bjkt55at6sckhr523kyskw7cd5i6deey5c77e8th9s26mhaz9k9r1j` (Nano Foundation Rep)

**Recommended: Set defaults once to avoid repeating parameters:**

```json
{
  "rpcUrl": "https://rpc.nano.org",
  "defaultRepresentative": "nano_1iuz18nxc4am6i4ixn7enj9tusyz8c3nyohmm77bzzd95sx9xmr9xh9qg9b"
}
```

Call `config_set` with these values at the start of your session.

## 1. Creating or Importing a Wallet

Call MCP tool:
- `wallet_create` with `{ "name": "A", "format": "bip39", "count": 1 }`

If you generated a wallet offline (e.g. using `create-wallet`) or the user provided keys, you can securely import them into the MCP:
- `wallet_create` with `{ "name": "A", "mnemonic": "word1 word2...", "count": 1 }`

Expected result shape:
- wallet name + format
- `A[0]` address (`nano_...`)

## 2. Reading Balances (MCP Resources & Tools)

**Passively reading state via MCP Resources (Recommended):**
You can passively read the available accounts, their open state, and balances without making heavy tool calls by requesting the MCP Resource URI:
- `wallet://{name}` - Returns a summary of the wallet and its first 5 accounts.
- `wallet://{name}/account/{index}` - Returns specific pending blocks and details for an account index.

**Actively reading state via Tools:**
- `wallet_balance` with `{ "name": "A", "index": 0 }`
- `wallet_probe_balances` with `{ "name": "A", "count": 5 }` - Also shows which accounts are opened

## 3. Receiving Funds (Crucial: Opening Accounts)

Nano transfers can show up as **pending** until you publish a corresponding receive/open block. A raw address alone does not "auto-receive" funds.

**If someone sends you funds, you MUST proactively call `wallet_receive` to fully pocket the funds and open the account.**

- `wallet_receive` with `{ "name": "A", "index": 0, "count": 10 }`

**Important for unopened accounts:**
- If the account is unopened (first receive), `wallet_receive` requires a representative.
- If you set `defaultRepresentative` in `config_set`, it will be used automatically.
- Otherwise, pass `representative` parameter explicitly.
- If neither is set, xno-mcp will use a well-known representative as fallback.

## 4. Sending Funds

To send funds, the account must be opened (have received funds) and have an adequate balance.
- `wallet_send` with `{ "name": "A", "index": 0, "destination": "nano_...", "amountXno": "0.01" }`

**Error: "Account is unopened"** - You must receive funds first using `wallet_receive`.

## Quick Start Example

```
1. config_set: { "rpcUrl": "https://rpc.nano.org", "defaultRepresentative": "nano_1iuz18nxc4am6i4ixn7enj9tusyz8c3nyohmm77bzzd95sx9xmr9xh9qg9b" }
2. wallet_create: { "name": "mywallet" }
3. (User sends funds to the address)
4. wallet_receive: { "name": "mywallet" }
5. wallet_send: { "name": "mywallet", "destination": "nano_...", "amountXno": "0.01" }
```

## Notes
- Wallet persistence is optional and off by default. If enabled, it's stored as plaintext JSON under `.xno-mcp/wallets.json`.
- The `workUrl` parameter defaults to `rpcUrl` - most nodes support work generation.