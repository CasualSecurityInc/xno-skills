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

> **CLI Execution Priority**: Do not assume `xno-skills` or `ows` are installed globally. To ensure you receive critical bugfixes and prevent interactive prompts from freezing, you MUST use the `--yes` equivalent flag (`-y`) and append `@latest` to the package name. Always use the following order of priority:
> 1. `bunx -y <package>@latest <command>`
> 2. `pnpm dlx <package>@latest <command>`
> 3. `npx -y <package>@latest <command>`
> 
> *Example:* `bunx -y ows@latest wallet list` or `bunx -y xno-skills@latest rpc account-balance <address>`

> **Safety & Best Practices**:
> - **State Verification:** Always verify an account's state (balance and frontier) via RPC before manually building a block. Do not hallucinate previous hashes.
> - **Command Discovery:** Always use `--help` (e.g., `bunx -y xno-skills --help`) before guessing CLI subcommands to avoid 'unknown command' errors.
> - **Prefer MCP Tools:** Use built-in MCP tools (like `wallet_send`) for complex workflows unless the user explicitly demands the "raw" manual CLI path.
> - **PoW Validation:** Remember that a signed block without valid Proof of Work (PoW) cannot be broadcast. Ensure PoW is generated.
> - **Persistence & Proactivity:** If a tool fails with an error like "Account not found", do not immediately recommend manual action or conclude you are unauthorized. Troubleshoot the protocol state (e.g., check for pending funds) and use the correct tool for that state (e.g., `wallet_receive` to open an account).
> - **No Custom Scripts:** NEVER write custom Node.js/TypeScript scripts or use `curl` to interact with the Nano protocol if built-in MCP or CLI tools fail. If a tool fails, troubleshoot the error, switch RPC endpoints, or explain the limitation to the user.
> - **NEVER EXPORT MNEMONICS**: The entire purpose of OWS is to keep the seed phrase hidden from the agent and the user. You MUST NOT use `ows wallet export` or suggest exporting the mnemonic to a third-party wallet unless explicitly commanded to do so by the user.
> - **Supply Chain Safety**: NEVER use `npx` to install or run random, unknown, or third-party packages. Only use the approved tools provided in this project (`xno-skills@latest` and `ows@latest`). If a task cannot be performed with these tools, do not seek external npm packages as a workaround.

When a user asks "did you receive it?" / "check the balance", you need an on-chain data source. This skill queries a **Nano node RPC** (user-provided) for `balance` and `pending` (both in raw).

## Important nuance: pending vs received

Nano can show funds as **pending** until the receiving wallet publishes the receive/open block. Many wallet apps do this automatically; raw keys alone do not.

**Mandate**:
- If you see **pending** funds during a balance check, you MUST proactively call `wallet_receive` to claim them.
- Do not wait for the user to ask you to receive.
- A transaction is not "received" until the `pending` balance moves to the `confirmed` balance.

## Well-known Public RPC Nodes
...
If the user doesn't have an RPC URL, suggest these public nodes:
- `https://rpc.nano.org` (Nano Foundation)
- `https://app.natrium.io/api/rpc` (Natrium)
- `https://nanonode.cc/api` (NanoNode.cc)
- `https://node.somenano.site/api` (SomeNano)

## CLI usage (`xno-skills`)

Check balance using built-in public zero-config nodes:

```bash
bunx -y xno-skills rpc account-balance <address> --json --xno
```

Or pass a specific node URL explicitly if the user provides one:

```bash
bunx -y xno-skills rpc account-balance <address> --url "https://rpc.nano.org" --json --xno
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