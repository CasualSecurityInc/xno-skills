# xno-skills

[![npm version](https://img.shields.io/npm/v/xno-skills.svg)](https://www.npmjs.com/package/xno-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A TypeScript library for interacting with the Nano (XNO) cryptocurrency. Generate wallets, convert units, validate addresses, and more.

![xno-skills CLI preview](assets/xno-skills-cli.svg)

## AI Skills

This repository includes built-in skills for AI agents (Claude Code, Cursor, etc.). To install them:

```bash
npx skills add CasualSecurityInc/xno-skills
```

Available skills:
- `create-wallet`: Wallet creation/import guidance (BIP39 default; legacy supported; safe `--stdin` workflows).
- `convert-units`: High-precision unit conversion reference.
- `generate-qr`: Terminal-friendly Nano payment QR codes (address + optional amount).
- `validate-address`: Address format and checksum verification guide.
- `check-balance`: Check balance/pending via Nano node RPC.
- `mcp-purse`: Use `xno-mcp` as a private “purse” custody blackbox (addresses only; no seed leakage).

## MCP Server

This package includes a built-in Model Context Protocol (MCP) server that exposes Nano wallet functions as native tools for AI agents (like Claude Desktop or Cursor).

To use it, add the following to your MCP client configuration:

```json
{
  "mcpServers": {
    "xno": {
      "command": "npx",
      "args": ["-y", "-p", "xno-skills@^0.3.0", "xno-mcp"]
    }
  }
}
```

Exposed tools:
- `purse_create` / `purse_list` / `purse_addresses`: Named “purses” (custody inside MCP; return addresses only).
- `purse_balance` / `purse_probe_balances`: Balance/pending checks for purse accounts via RPC.
- `config_get` / `config_set`: Store defaults (RPC URL, timeouts; optional purse persistence).
- `generate_wallet`: Generate a wallet (default: BIP39 derivation).
- `derive_address`: Derive an address (supports `bip39` + `legacy`, with `auto` preference).
- `probe_mnemonic`: Probe both derivations via RPC (helps resolve 24-word ambiguity).
- `convert_units`: Converts between XNO and raw units.
- `validate_address`: Validates address format and checksum.

## Installation

```bash
npm install xno-skills
```

## Releasing

See `RELEASING.md`.

## Quick Start

```typescript
import { 
  generateMnemonic,
  deriveAddressBIP44,
  validateAddress,
  nanoToRaw,
  rawToNano
} from 'xno-skills';

// Generate a new BIP39 wallet + first account (index 0)
const mnemonic = generateMnemonic(24);
const { address, privateKey, publicKey } = deriveAddressBIP44(mnemonic, 0);

console.log('Address:', address);
// nano_1abc123...

// Validate an address
const result = validateAddress(address);
console.log(result.valid); // true

// Convert units
const raw = nanoToRaw('1.5'); // "1500000000000000000000000000000"
const nano = rawToNano(raw);  // "1.5"
```

## CLI Usage

Install globally or use with `npx`:

```bash
# Install globally
npm install -g xno-skills

# Or use with npx
npx xno-skills --help
```

### Wallet Commands

Security note: avoid pasting mnemonics/seeds into chat logs. Prefer `--stdin` (or `--mnemonic-env`) for import/probing commands.

#### Create a new wallet

```bash
# Default: BIP39 derivation
xno-skills wallet create

# Choose legacy derivation (24-word “seed phrase” style)
xno-skills wallet create --format legacy

# Control BIP39 word count / passphrase / index
xno-skills wallet create --words 12
xno-skills wallet create --passphrase "optional passphrase"
xno-skills wallet create --index 0

# JSON output
xno-skills wallet create --json
```

#### Restore from mnemonic

```bash
# Safer import via stdin (recommended)
echo "word1 word2 ... word24" | xno-skills wallet from-mnemonic --stdin --json

# JSON output
xno-skills wallet from-mnemonic --stdin --json
```

#### Probe mnemonic ambiguity (24-word)

If you have a Nano RPC endpoint, you can probe the first few indexes for both derivations and see which accounts are opened / have balances:

```bash
export NANO_RPC_URL="http://127.0.0.1:7076"
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

```bash
export NANO_RPC_URL="http://127.0.0.1:7076"
xno-skills rpc account-balance nano_1abc123... --json --xno
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

## License

MIT
