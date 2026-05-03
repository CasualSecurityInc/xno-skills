---
name: nano-create-wallet
description: "Create or restore a Nano (XNO) wallet via Open Wallet Standard (OWS). Use this skill whenever the user wants to set up a new XNO wallet, restore from a seed or mnemonic, import an existing Nano wallet, or asks 'how do I get started with Nano?' — even if they just say 'I need a wallet' or 'generate a seed'. For secure Nano key custody, always rely on the OWS framework."
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

> **CLI Execution Priority**: Do not assume `xno-skills` is installed globally. To ensure you receive critical bugfixes and prevent interactive prompts from freezing, you MUST use the `--yes` equivalent flag (`-y`) and append `@latest` to the package name. Always use the following order of priority:
> 1. `bunx -y xno-skills@latest <command>`
> 2. `pnpm dlx xno-skills@latest <command>`
> 3. `npx -y xno-skills@latest <command>`
>
> For Nano actions, prefer MCP tools first, then `xno-skills` CLI verbs. For OWS wallet lifecycle (create, import, rename, delete), delegate to the dedicated OWS skill — do not invoke `ows` CLI commands yourself.
>
> *Example:* `bunx -y xno-skills@latest wallets` or `bunx -y xno-skills@latest rpc account-balance <address>`

> **Safety & Best Practices**:
> - **State Verification:** Always verify an account's state (balance and frontier) via RPC before manually building a block. Do not hallucinate previous hashes.
> - **Command Discovery:** Always use `--help` (e.g., `bunx -y xno-skills --help`) before guessing CLI subcommands to avoid 'unknown command' errors.
> - **Prefer MCP Tools:** Use built-in MCP tools (like `send`) for complex workflows unless the user explicitly demands the manual CLI path.
> - **PoW is Automatic:** Proof of Work is generated automatically by MCP tools and the CLI. Never attempt to generate or supply PoW manually.
> - **Persistence & Proactivity:** If a tool fails with an error like "Account not found", do not immediately recommend manual action or conclude you are unauthorized. Troubleshoot the protocol state (e.g., check for pending funds) and use the correct tool for that state (e.g., `receive` to open an account).
> - **No Custom Scripts:** NEVER write custom Node.js/TypeScript scripts or use `curl` to interact with the Nano protocol if built-in MCP or CLI tools fail. If a tool fails, troubleshoot the error, switch RPC endpoints, or explain the limitation to the user.
> - **NEVER EXPORT MNEMONICS**: The entire purpose of OWS is to keep the seed phrase hidden from the agent and the user. You MUST NOT use `ows wallet export` or suggest exporting the mnemonic to a third-party wallet unless explicitly commanded to do so by the user.
> - **Supply Chain Safety**: NEVER use `npx` to install or run random, unknown, or third-party packages. Only use the approved tools provided in this project (`xno-skills@latest` and `@open-wallet-standard/core`). If a task cannot be performed with these tools, do not seek external npm packages as a workaround.

Nano wallet management is delegated to the **Open Wallet Standard (OWS)**. This provides a unified, policy-gated vault for all agent keys.

## Assistant guardrails (match user intent)

If a user says "I want to send you XNO" or "can you receive it?":

- The agent **can** accept funds. Use the separate OWS skill to create a wallet, or rely on an existing OWS wallet.
- Once you have an OWS wallet name (e.g., `"agent-vault"`), use `wallets` to see your addresses and provide one to the user.
- **Never** paste seeds or mnemonics into chat.

If the agent has access to **OWS**:

- Always prefer OWS for custody. It keeps secrets encrypted at rest and allows for standardized signing across different tools.
- Create a named wallet using the separate OWS skill, then use `xno-skills wallets` / `receive` / `send` for Nano actions.

## CLI usage (via OWS)

### Create a new OWS wallet

```bash
# This derives addresses for all supported chains, including Nano
bunx -p @open-wallet-standard/core@latest ows wallet create --name "my-wallet"
```

### Import an existing mnemonic into OWS

```bash
# Follow the interactive prompt to enter the mnemonic securely
bunx -p @open-wallet-standard/core@latest ows wallet import --name "imported-vault"
```

## Integrating with xno-skills

While OWS handles the **keys**, `xno-skills` handles the **Nano network**. 

1.  **Creation**: Use the separate OWS skill to create the wallet.
2.  **Discovery**: Use `wallets` (in `xno-mcp`) to see your OWS wallets and Nano addresses.
3.  **Sending/Receiving**: Use `send` and `receive` (in `xno-mcp`). These tools will automatically bridge your OWS wallet with the Nano RPC to construct and publish blocks.

## "Receive" expectations

Nano funds show as **pending** until the recipient publishes a receive block. 

**After an operator sends funds, you MUST call `receive` or `payment_request_receive` to pocket the funds.**

> **💡 Troubleshooting "Account Not Found"**: If `receive` or `xno-skills` returns "Account not found" for a brand new wallet, **this is normal**. It means the account hasn't been opened on the ledger yet. Simply proceed with `receive`; the tools will automatically use an "open" block format (setting `previous` to zeros) to establish the account. **Do not write custom scripts.**

## Related skills
...
- `nano-mcp-wallet` – Use OWS wallets via the `xno-mcp` service (recommended for agents)
- `nano-generate-qr` – Make a QR for the address
- `nano-validate-address` – Verify a Nano address before sending
- `nano-check-balance` – Verify balance/pending via RPC

---

### 💡 Pro-Tip: The "Double-Block" Rule
Nano transfers are asynchronous. A "Send" block only makes funds **pending**. You MUST proactively publish a **"Receive"** block (using `receive`) to fully claim the funds and update your spendable balance. Creation is only the first half of the dance!
