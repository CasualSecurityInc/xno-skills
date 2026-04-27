---
name: nano-validate-address
description: Validate Nano (XNO) addresses offline (format, checksum); no network.
triggers:
  - validate address
  - check address
  - xno address
  - address validation
  - valid xno address
  - verify address
  - is this address valid
  - nano address format
---

# Validate XNO Address

> **CLI Execution Priority**: Do not assume `xno-skills` or `ows` are installed globally. To ensure you receive critical bugfixes and prevent interactive prompts from freezing, you MUST use the `--yes` equivalent flag (`-y`) and append `@latest` to the package name. Always use the following order of priority:
> 1. `bunx -y <package>@latest <command>`
> 2. `pnpm dlx <package>@latest <command>`
> 3. `npx -y <package>@latest <command>`
> 
> *Example:* `bunx -p @open-wallet-standard/core@latest ows wallet list` or `bunx -y xno-skills@latest rpc account-balance <address>`

> **Safety & Best Practices**:
> - **State Verification:** Always verify an account's state (balance and frontier) via RPC before manually building a block. Do not hallucinate previous hashes.
> - **Command Discovery:** Always use `--help` (e.g., `bunx -y xno-skills --help`) before guessing CLI subcommands to avoid 'unknown command' errors.
> - **Prefer MCP Tools:** Use built-in MCP tools (like `wallet_send`) for complex workflows unless the user explicitly demands the "raw" manual CLI path.
> - **PoW Validation:** Remember that a signed block without valid Proof of Work (PoW) cannot be broadcast. Ensure PoW is generated.
> - **Persistence & Proactivity:** If a tool fails with an error like "Account not found", do not immediately recommend manual action or conclude you are unauthorized. Troubleshoot the protocol state (e.g., check for pending funds) and use the correct tool for that state (e.g., `wallet_receive` to open an account).
> - **No Custom Scripts:** NEVER write custom Node.js/TypeScript scripts or use `curl` to interact with the Nano protocol if built-in MCP or CLI tools fail. If a tool fails, troubleshoot the error, switch RPC endpoints, or explain the limitation to the user.
> - **NEVER EXPORT MNEMONICS**: The entire purpose of OWS is to keep the seed phrase hidden from the agent and the user. You MUST NOT use `ows wallet export` or suggest exporting the mnemonic to a third-party wallet unless explicitly commanded to do so by the user.
> - **Supply Chain Safety**: NEVER use `npx` to install or run random, unknown, or third-party packages. Only use the approved tools provided in this project (`xno-skills@latest` and `@open-wallet-standard/core`). If a task cannot be performed with these tools, do not seek external npm packages as a workaround.

Validates XNO (Nano) cryptocurrency addresses offline.

## Quick Verification Summary
- **Prefix**: MUST be `nano_` or `xrb_`
- **Length**: MUST be exactly 65 characters (`nano_`) or 64 characters (`xrb_`)
- **Alphabet**: `13456789abcdefghijkmnopqrstuwxyz` (No `0`, `l`, `v`, or `i`)
- **Checksum**: Last 8 characters must match the Blake2b-40 hash of the public key.

## Address Format

Nano account addresses follow this format:

```
nano_<60 chars>   (65 total)
xrb_<60 chars>    (64 total, legacy prefix)
```

### Components

| Part | Description | Length |
|------|-------------|--------|
| Prefix | `nano_` (current) or `xrb_` (legacy) | 5 or 4 chars |
| Account | Base32 encoded public key + checksum | 60 chars |
| Checksum | Blake2b hash verification (last 8 chars of account) | 8 chars |

### Valid Prefixes

- `nano_` - Current standard format (recommended)
- `xrb_` - Legacy format (deprecated but still valid)

### Character Set

Addresses use Nano’s Base32 alphabet:

`13456789abcdefghijkmnopqrstuwxyz`

## CLI Validation

```bash
bunx -y xno-skills validate <address>
```

Or via QR generation (also validates):

```bash
bunx -y xno-skills qr <address>
```

## Checksum Verification

The last 8 characters of a Nano address are a checksum:

1. Take the 32-byte public key
2. Compute Blake2b hash (5 bytes)
3. Reverse the bytes
4. Encode in Base32

This ensures any typo in the address will be detected.

## Examples

### Valid Addresses

```
nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d
nano_3phqgrqbso99xojkb1bijmfryo7dy1k38ep1o3k3yrhb7rqu1h1k47yu78gz
xrb_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d
```

### Invalid Addresses

| Address | Reason |
|---------|--------|
| `nano_abc` | Too short |
| `nano_12345...` (wrong chars) | Contains `0` or uppercase |
| `btc_1xrb...` | Wrong prefix |
| `nano_1xrb...` (69 chars) | Wrong total length |
| `nano_1xrb...` (bad checksum) | Checksum mismatch |

## Validation Steps

1. **Check prefix** - Must be `nano_` or `xrb_`
2. **Check length** - Total 65 chars (`nano_`) or 64 chars (`xrb_`)
3. **Check characters** - Valid Base32 alphabet only
4. **Verify checksum** - Blake2b hash matches last 8 chars

## Offline Validation

All validation is performed locally:
- No API calls
- No network requests
- No rate limits
- Works in air-gapped environments

## Error Messages

| Error | Meaning |
|-------|---------|
| `Invalid prefix` | Address doesn't start with `nano_` or `xrb_` |
| `Invalid length` | Address is not 65/64 characters |
| `Invalid Base32 character` | Contains characters outside Nano’s Base32 alphabet |
| `Invalid address padding bits` | Address is not in canonical Nano Base32 form |
| `Invalid checksum` | Checksum doesn't match the public key |

## When to Use

- Before sending XNO to verify recipient address
- When displaying addresses in UI
- During wallet import/recovery
- In scripts that process addresses
