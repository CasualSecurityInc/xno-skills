---
name: Nano Wallet Operations
description: Create or restore a Nano (XNO) wallet offline (seed, mnemonic, address).
triggers:
  - create wallet
  - generate wallet
  - new wallet
  - wallet create
  - xno-skills wallet
  - create xno-skills wallet
  - nano wallet
  - cryptocurrency wallet
---

# Create / Restore a Nano (XNO) Wallet (Offline)

Creates or restores a Nano wallet locally using `xno-skills`. This is useful for **testing** (generating an address to fund) and for **deriving** the address from a known seed/mnemonic.

## Assistant guardrails (match user intent)

If a user says “I want to send you XNO” or “can you receive it?”:

- Do **not** imply the agent can accept funds.
- Offer to help them **create a wallet for themselves** (or validate/QR their existing address).
- If they want a throwaway test wallet, remind them that anything printed in chat (seed/mnemonic/private key) should be considered **compromised** and **not used for real funds**.

If a user asks to **import/restore** an existing wallet:

- **Warn before asking for any mnemonic/seed.** Tell them not to paste secrets into chat.
- Ask whether the wallet may contain significant funds; if yes, steer them to an offline wallet app/hardware wallet instead.
- If they still want help, have them run `xno-skills` **locally** and share only non-sensitive outputs (addresses, balances).

If the agent has access to **`xno-mcp`**:

- Prefer using `xno-mcp` as a private “purse” blackbox (custody inside MCP), so the LLM never needs to see seeds/mnemonics.
- Create a named purse (e.g. `"A"`) and only return the address(es) needed for funding/checking balances.

## Two common Nano mnemonic schemes (both supported)

Nano wallets commonly use **either**:

- **BIP39 (preferred / default in `xno-skills`)**: 12/15/18/21/24-word BIP39 mnemonic (+ optional passphrase) → BIP39 seed (PBKDF2) → Nano keys via BIP44-style path `m/44'/165'/index'`.
- **Legacy (“Nano mnemonic”, 24 words)**: 24-word mnemonic → underlying entropy treated as a 32-byte Nano seed → Nano legacy key derivation `blake2b(seed || index)` to derive multiple accounts.

Important: a **24-word** phrase can be *ambiguous* (it can be used in both schemes). Prefer BIP39 unless the user explicitly knows they have a legacy mnemonic.

## CLI usage

### Create a new BIP39 wallet (default)

```bash
npx -y xno-skills wallet create --json
```

### Create a legacy (24-word) wallet

```bash
npx -y xno-skills wallet create --format legacy --json
```

### Restore/import from mnemonic

```bash
# Auto (24-word is ambiguous; prefers bip39)
npx -y xno-skills wallet from-mnemonic --stdin --json

# Force a format
npx -y xno-skills wallet from-mnemonic --stdin --format bip39 --json
npx -y xno-skills wallet from-mnemonic --stdin --format legacy --json

# For 24-word mnemonics: output both derivations (JSON)
npx -y xno-skills wallet from-mnemonic --stdin --format auto --both --json
```

### Safest disambiguation: probe both on-chain

If you have an RPC endpoint, scan the first 5 indexes of both schemes and see which has opened accounts / balances:

```bash
export NANO_RPC_URL="http://127.0.0.1:7076"
npx -y xno-skills wallet probe-mnemonic "<mnemonic>" --json
```

## “Receive” expectations

Nano transfers can show up as **pending** until the recipient wallet publishes the corresponding receive/open block. A typical wallet app handles this automatically; a raw seed/address alone does not “auto-receive”.

To check whether funds arrived on-chain (balance/pending), use the `check-balance` skill (RPC) or a block explorer.

## Related skills

- `generate-qr` – make a QR for the address (optionally with amount)
- `validate-address` – verify a Nano address before sending
- `check-balance` – verify balance/pending via RPC (if you have a node endpoint)
