# xno-skills

[![npm version](https://img.shields.io/npm/v/xno-skills.svg)](https://www.npmjs.com/package/xno-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A TypeScript library, CLI, and MCP server for Nano (XNO) actions. Pairs with Open Wallet Standard (OWS) for secure key custody — send, receive, change representatives, convert units, validate addresses, sign/verify messages, and more.

![xno-skills CLI preview](assets/xno-skills-cli.png)

## AI Skills

This repository includes built-in skills for AI agents (Claude Code, Cursor, etc.). To install them:

```bash
npx skills add CasualSecurityInc/xno-skills
```

Available skills (v2.0.0+):
- `nano-check-balance`: Check balance/pending via Nano node RPC.
- `nano-convert-units`: High-precision unit conversion reference.
- `nano-create-wallet`: Wallet creation/import guidance (BIP39/Legacy support).
- `nano-generate-qr`: Terminal-friendly Nano payment QR codes.
- `nano-mcp-wallet`: Use `xno-mcp` as a private “wallet” custody blackbox.
- `nano-request-payment`: Request XNO from operator (payment request workflow).
- `nano-return-funds`: Return XNO to sender safely.
- `nano-sign-message`: Sign off-chain messages (NOMS/ORIS-001).
- `nano-validate-address`: Address format and checksum verification.
- `nano-verify-message`: Verify off-chain message signatures.
- `nano-block-lattice-expert`: Deep protocol wisdom and 2026 operational facts.

### Migration (from < v1.4.0)

If you have old skills installed without the `nano-` prefix, you should remove them and re-add the repo to avoid name collisions and "ghost" skills:

```bash
# 1. Remove old generic names
npx skills remove -g check-balance convert-units create-wallet generate-qr mcp-wallet request-payment return-funds sign-message validate-address verify-message

# 2. Add the new prefixed skills
npx skills add -g CasualSecurityInc/xno-skills
```

## MCP Server

This package includes a built-in Model Context Protocol (MCP) server that exposes Nano wallet functions as native tools for AI agents (like Claude Desktop or Cursor).

To use it, add the following to your MCP client configuration:

```json
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "xno-skills@latest", "xno-mcp"]
    }
  }
}
```

Exposed tools:
- `wallets`: List OWS wallets and their Nano addresses.
- `address`: Get the Nano address for a wallet account index.
- `balance`: Check confirmed balance and pending for a wallet account.
- `pending`: List pending receivable blocks.
- `receive`: Receive pending blocks (handles open/first-receive automatically).
- `send`: Send XNO from a wallet account to a destination address.
- `change`: Change the representative for a wallet account.
- `submit_block`: Broadcast a pre-signed block hex (advanced/manual path).
- `history`: Persistent transaction log.
- `payment_request_create` / `payment_request_status` / `payment_request_receive` / `payment_request_list` / `payment_request_refund`: Full payment request lifecycle.
- `config_get` / `config_set`: Manage server settings (RPC URL, representative, spending cap, etc.).
- `convert_units`: High-precision unit conversion.
- `validate_address`: Offline address validation.
- `rpc_account_balance`: Direct RPC balance check for any address.
- `generate_qr`: Generate ASCII QR codes.
- `sign_message` / `verify_message`: Sign and verify off-chain messages (NOMS).

> **Compatibility aliases** (kept for one release): `wallet_list`, `wallet_balance`, `wallet_receive`, `wallet_send`, `wallet_history` map to the canonical tools above.

## Installation

```bash
npm install xno-skills
```

## Releasing

See `RELEASING.md`.

## MCP Client Setup (Codex, Claude, OpenCode, Gemini, VS Code)

All examples run the MCP server via `npx` (swap `@latest` for a pinned version if you prefer).

### Codex

```bash
codex mcp add xno \
  -c sandbox_mode="danger-full-access" \
  -c 'sandbox_permissions=["network-access"]' \
  -- npx -y -p xno-skills@latest xno-mcp
```

### Claude Desktop (`claude_desktop_config.json`)

Add via Claude Desktop: Settings -> Developer -> Edit Config.

```json
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "-p", "xno-skills@latest", "xno-mcp"]
    }
  }
}
```

### OpenCode (`opencode.jsonc`)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "xno": {
      "type": "local",
      "command": ["npx", "-y", "-p", "xno-skills@latest", "xno-mcp"],
      "enabled": true
    }
  }
}
```

### Gemini CLI (`settings.json`)

```json
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "-p", "xno-skills@latest", "xno-mcp"]
    }
  }
}
```

### VS Code (`.vscode/mcp.json`)

```json
{
  "servers": {
    "xno": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "-p", "xno-skills@latest", "xno-mcp"]
    }
  }
}
```

## CLI Usage

Install globally or use with `npx`:

```bash
# Install globally
npm install -g xno-skills

# Or use with npx
npx xno-skills --help
```

### Wallet Discovery

Wallet lifecycle (create, import, rename, delete) is managed by [Open Wallet Standard (OWS)](https://github.com/open-wallet-standard/core). Use the `nano-create-wallet` skill or the OWS skill for that.

> **Note:** `xno-skills` bundles OWS as an npm dependency — you do **not** need to install it separately. If you want to manage wallets directly from the terminal (outside of an agent), the [OWS quick-start guide](https://openwallet.sh/#quickstart) explains how. To install OWS agent skills, run:
> ```bash
> npx skills add open-wallet-standard/core@ows
> ```

Once you have an OWS wallet, use these commands to interact with it on Nano:

```bash
# List OWS wallets and their Nano addresses
xno-skills wallets

# Get the Nano address for a specific wallet and account index
xno-skills address --wallet my-wallet --index 0
```

#### Restore from mnemonic

```bash
# Safer import via stdin (recommended)
echo "word1 word2 ... word24" | xno-skills wallet from-mnemonic --stdin --json

# JSON output
xno-skills wallet from-mnemonic --stdin --json
```

#### Probe mnemonic ambiguity (24-word)

If you have a specific Nano RPC endpoint you want to use, you can set `NANO_RPC_URL`. Otherwise, it will automatically use public zero-config nodes:

```bash
echo "word1 word2 ... word24" | xno-skills wallet probe-mnemonic --stdin --json
```

### Convert Units

```bash
# Convert XNO to raw
xno-skills convert 1.5 xno --to raw

# Convert raw to XNO
xno-skills convert 1500000000000000000000000000000 raw --to xno

# Convert between units
xno-skills convert 1 mnano --to knano

# JSON output
xno-skills convert 1 xno --to raw --json
```

Supported units:
- `xno` or `nano` - Nano (10^30 raw)
- `knano` - Kilo-nano (10^27 raw)
- `mnano` - Mega-nano (10^24 raw)
- `raw` - Base unit

### Generate QR Codes

```bash
# QR code for address
xno-skills qr nano_1abc123...

# QR code with amount
xno-skills qr nano_1abc123... --amount 1.5

# JSON output
xno-skills qr nano_1abc123... --json
```

### Validate Addresses

```bash
xno-skills validate nano_1abc123...
```

### RPC (balance/pending)

Check balance using built-in public nodes:

```bash
xno-skills rpc account-balance nano_1abc123... --json --xno
```

Or override with a specific URL:

```bash
xno-skills rpc account-balance nano_1abc123... --url "http://127.0.0.1:7076" --json --xno
```

## API Reference

### Seed Generation

#### `generateMnemonic(wordCount = 24): string`

Generate a BIP39 mnemonic (12/15/18/21/24 words).

```typescript
import { generateMnemonic } from 'xno-skills';

const mnemonic = generateMnemonic(24);
```

#### `generateSeed(): string`

Generate a cryptographically secure 32-byte seed (256 bits).

```typescript
import { generateSeed } from 'xno-skills';

const seed = generateSeed();
// Returns: "0123456789abcdef..." (64 hex characters)
```

#### `seedToMnemonic(seed: string): string`

Convert a hex-encoded seed to a BIP39 mnemonic phrase.

```typescript
import { seedToMnemonic } from 'xno-skills';

const mnemonic = seedToMnemonic(seed);
// Returns: "word1 word2 word3 ... word24"
```

#### `mnemonicToSeed(mnemonic: string): string`

Convert a BIP39 mnemonic phrase back to its underlying entropy (hex).

Note: this is **not** the BIP39 PBKDF2 “seed”; it’s the raw entropy the mnemonic encodes.

```typescript
import { mnemonicToSeed } from 'xno-skills';

const seed = mnemonicToSeed(mnemonic);
// Returns: "0123456789abcdef..." (64 hex characters)
```

#### `mnemonicToBIP39Seed(mnemonic: string, passphrase?: string): string`

Convert a BIP39 mnemonic (+ optional passphrase) to the PBKDF2 “seed” hex used for HD derivation.

#### `validateMnemonic(mnemonic: string): boolean`

Validate a BIP39 mnemonic phrase.

```typescript
import { validateMnemonic } from 'xno-skills';

const isValid = validateMnemonic(mnemonic);
// Returns: true or false
```

### Legacy Address Derivation

#### `deriveAddressLegacy(seed: string, index: number): LegacyAddressResult`

Derive a Nano address from a seed using the legacy derivation method.

```typescript
import { deriveAddressLegacy } from 'xno-skills';

const result = deriveAddressLegacy(seed, 0);
// Returns: { address, privateKey, publicKey }
```

#### `derivePrivateKeyLegacy(seed: string, index: number): string`

Derive a private key from a seed at the specified index.

```typescript
import { derivePrivateKeyLegacy } from 'xno-skills';

const privateKey = derivePrivateKeyLegacy(seed, 0);
// Returns: "0123456789abcdef..." (64 hex characters)
```

#### `derivePublicKeyLegacy(privateKey: string): string`

Derive a public key from a private key.

```typescript
import { derivePublicKeyLegacy } from 'xno-skills';

const publicKey = derivePublicKeyLegacy(privateKey);
// Returns: "0123456789abcdef..." (64 hex characters)
```

#### `publicKeyToAddress(publicKey: string): string`

Convert a public key to a Nano address.

```typescript
import { publicKeyToAddress } from 'xno-skills';

const address = publicKeyToAddress(publicKey);
// Returns: "nano_1abc123..."
```

### BIP44 Address Derivation

#### `deriveAddressBIP44(mnemonic: string, index: number, passphrase?: string): BIP44AddressResult`

Derive a Nano address from a mnemonic using BIP44 path `m/44'/165'/[index]'`.

```typescript
import { deriveAddressBIP44 } from 'xno-skills';

const result = deriveAddressBIP44(mnemonic, 0);
// Returns: { address, privateKey, publicKey }

// With optional passphrase
const result = deriveAddressBIP44(mnemonic, 0, 'my-passphrase');
```

#### `derivePrivateKeyBIP44(mnemonic: string, index: number, passphrase?: string): string`

Derive a private key from a mnemonic using BIP44.

```typescript
import { derivePrivateKeyBIP44 } from 'xno-skills';

const privateKey = derivePrivateKeyBIP44(mnemonic, 0);
// Returns: "0123456789abcdef..." (64 hex characters)
```

#### `derivePublicKeyBIP44(privateKey: string): string`

Derive a public key from a BIP44-derived private key.

```typescript
import { derivePublicKeyBIP44 } from 'xno-skills';

const publicKey = derivePublicKeyBIP44(privateKey);
// Returns: "0123456789abcdef..." (64 hex characters)
```

#### `publicKeyToAddressBIP44(publicKey: string): string`

Convert a BIP44-derived public key to a Nano address.

```typescript
import { publicKeyToAddressBIP44 } from 'xno-skills';

const address = publicKeyToAddressBIP44(publicKey);
// Returns: "nano_1abc123..."
```

#### `validateMnemonicBIP44(mnemonic: string): boolean`

Validate a BIP39 mnemonic phrase for BIP44 usage.

```typescript
import { validateMnemonicBIP44 } from 'xno-skills';

const isValid = validateMnemonicBIP44(mnemonic);
// Returns: true or false
```

#### `mnemonicToBIP39Seed(mnemonic: string, passphrase?: string): string`

Convert a mnemonic to a BIP39 seed (512-bit).

```typescript
import { mnemonicToBIP39Seed } from 'xno-skills';

const seed = mnemonicToBIP39Seed(mnemonic);
// Returns: "0123456789abcdef..." (128 hex characters)
```

### Address Validation

#### `validateAddress(address: string): ValidateAddressResult`

Validate a Nano address and extract the public key.

```typescript
import { validateAddress } from 'xno-skills';

const result = validateAddress('nano_1abc123...');
// Returns: { valid: true, publicKey: "..." }
// Or: { valid: false, error: "Invalid prefix..." }
```

### Unit Conversion

#### `nanoToRaw(nano: string): string`

Convert Nano (XNO) to raw units.

```typescript
import { nanoToRaw } from 'xno-skills';

const raw = nanoToRaw('1.5');
// Returns: "1500000000000000000000000000000"
```

#### `rawToNano(raw: string, decimals?: number): string`

Convert raw units to Nano (XNO).

```typescript
import { rawToNano } from 'xno-skills';

const nano = rawToNano('1500000000000000000000000000000');
// Returns: "1.5"

// With specific decimal places
const nano = rawToNano(raw, 6);
// Returns: "1.500000"
```

#### `formatNano(raw: string): string`

Format raw units as Nano with full precision.

```typescript
import { formatNano } from 'xno-skills';

const formatted = formatNano('1500000000000000000000000000000');
// Returns: "1.5"
```

#### `knanoToRaw(knano: string): string`

Convert kilo-nano to raw units.

```typescript
import { knanoToRaw } from 'xno-skills';

const raw = knanoToRaw('1.5');
// Returns: "1500000000000000000000000000000000"
```

#### `mnanoToRaw(mnano: string): string`

Convert mega-nano to raw units.

```typescript
import { mnanoToRaw } from 'xno-skills';

const raw = mnanoToRaw('1.5');
// Returns: "1500000000000000000000000000000000000"
```

### Cryptographic Functions

#### `blake2b256(data: Uint8Array): Uint8Array`

Compute BLAKE2b-256 hash (32 bytes).

```typescript
import { blake2b256 } from 'xno-skills';

const hash = blake2b256(new TextEncoder().encode('hello'));
// Returns: Uint8Array(32)
```

#### `blake2b512(data: Uint8Array): Uint8Array`

Compute BLAKE2b-512 hash (64 bytes).

```typescript
import { blake2b512 } from 'xno-skills';

const hash = blake2b512(new TextEncoder().encode('hello'));
// Returns: Uint8Array(64)
```

#### `blake2b256Hex(data: Uint8Array): string`

Compute BLAKE2b-256 hash and return as hex string.

```typescript
import { blake2b256Hex } from 'xno-skills';

const hash = blake2b256Hex(new TextEncoder().encode('hello'));
// Returns: "abc123..." (64 hex characters)
```

### Base32 Encoding

#### `base32Encode(bytes: Uint8Array): string`

Encode bytes to Nano's Base32 format.

```typescript
import { base32Encode } from 'xno-skills';

const encoded = base32Encode(new Uint8Array([0x00, 0xff]));
// Returns: "1z"
```

#### `base32Decode(str: string): Uint8Array`

Decode Nano's Base32 format to bytes.

```typescript
import { base32Decode } from 'xno-skills';

const bytes = base32Decode('1z');
// Returns: Uint8Array([0x00, 0xff])
```

### QR Code Generation

#### `generateAsciiQr(address: string, amount?: number): Promise<string>`

Generate an ASCII QR code for a Nano address.

```typescript
import { generateAsciiQr } from 'xno-skills';

const qr = await generateAsciiQr('nano_1abc123...');
console.log(qr);

// With amount
const qr = await generateAsciiQr('nano_1abc123...', 1.5);
```

## Security Notes

**CRITICAL: Handle seeds and private keys with extreme care.**

1. **Never share your seed or private keys.** Anyone with access to these can fully control your wallet.

2. **Store seeds securely.** Use hardware wallets, encrypted storage, or offline backup methods. Never store seeds in plain text files, cloud storage, or version control.

3. **Use environment variables for seeds in development.** Never hardcode seeds in your source code.

4. **BIP44 vs Legacy derivation.** This library supports both:
   - **Legacy**: Uses Blake2b-based path derivation (original Nano method)
   - **BIP44**: Standard HD wallet derivation path `m/44'/165'/[index]'`
   
   Choose the method compatible with your existing wallet. Most Nano wallets use legacy derivation.

5. **Mnemonic phrases.** When using BIP44, the mnemonic phrase is the master key. Protect it as carefully as a seed.

6. **Passphrase protection.** BIP44 supports optional passphrases for additional security. A passphrase acts as a "25th word" - even if someone obtains your mnemonic, they cannot access funds without the passphrase.

7. **Address validation.** Always validate addresses before sending funds. Nano addresses include a checksum to catch typos.

8. **Unit precision.** Nano uses 30 decimal places. Always use string-based conversion functions to avoid floating-point precision errors.

## Development

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run integration tests
npx vitest run test/integration.test.ts

# Build
npm run build

# Build ESM
npm run build:esm

# Build CJS
npm run build:cjs
```

## Releasing

See `RELEASING.md`.

## Similar Projects

- [kilkelly/nano-currency-mcp-server](https://github.com/kilkelly/nano-currency-mcp-server) — MCP server for Nano with a simple per-transaction send limit
- [strawberry-labs/berrypay-cli](https://github.com/strawberry-labs/berrypay-cli) — Nano wallet CLI for AI agents with payment processing and auto-sweep

## License

MIT
