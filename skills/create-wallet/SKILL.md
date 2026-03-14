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

# Create XNO Wallet

Generates a new XNO cryptocurrency wallet with a 24-word BIP-39 seed phrase and derived address.

## Overview

This skill creates or restores a Nano (XNO) wallet offline. The CLI can generate a random 32-byte seed (hex), show a 24-word BIP-39 mnemonic, and derive the corresponding Nano address.

## CLI Commands

### Basic Wallet Creation

```bash
npx -y xno-skills wallet create
```

Output:
```
Seed: 0123456789abcdef... (64 hex chars)
Mnemonic: word1 word2 ... word24
Address: nano_1abc123...
```

### Create with Mnemonic Output

```bash
npx -y xno-skills wallet create --mnemonic
```

Explicitly requests mnemonic (seed phrase) format output.

### Create with JSON Output

```bash
npx -y xno-skills wallet create --json
```

Returns structured JSON output:
```json
{
  "seed": "0123456789abcdef... (64 hex chars)",
  "mnemonic": "word1 word2 ... word24",
  "address": "nano_1abc123..."
}
```

### Output Only The Seed (Hex)

```bash
npx -y xno-skills wallet create --seed
```

Prints only the 64-hex-character seed.

### Restore From Mnemonic

```bash
npx -y xno-skills wallet from-mnemonic "word1 word2 ... word24"

# JSON output
npx -y xno-skills wallet from-mnemonic "word1 word2 ... word24" --json
```

## Step-by-Step Workflow

### 1. Generate New Wallet

```bash
npx -y xno-skills wallet create --json
```

### 2. Securely Store the Seed

**CRITICAL: Never store seeds in plain text files or code repositories.**

Option A - Environment Variable:
```bash
# Add to shell profile or .env file
export XNO_SEED_HEX="0123456789abcdef... (64 hex chars)"
export XNO_MNEMONIC="word1 word2 ... word24"
```

Option B - Secure Key Store:
```bash
# Use a password manager or hardware wallet
```

### 3. Verify the Address

```bash
npx -y xno-skills wallet from-mnemonic "$XNO_MNEMONIC" --json
```

Confirm the derived address matches your records.

## Programmatic Usage

### TypeScript/JavaScript

```typescript
import { generateSeed, seedToMnemonic, deriveAddressLegacy } from 'xno-skills';

// Generate seed + mnemonic
const seed = generateSeed();
const mnemonic = seedToMnemonic(seed);

// Derive the first legacy address (index 0)
const { address } = deriveAddressLegacy(seed, 0);
console.log(address); // nano_...

// Derive from existing seed (hex)
const existingSeed = process.env.XNO_SEED_HEX!;
console.log(deriveAddressLegacy(existingSeed, 0).address);
```

### With Error Handling

```typescript
import { deriveAddressLegacy, seedToMnemonic, validateMnemonic } from 'xno-skills';

function safeDeriveAddress(seedHex: string) {
  try {
    return { ok: true as const, address: deriveAddressLegacy(seedHex, 0).address };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

function safeMnemonicRoundtrip(seedHex: string) {
  const mnemonic = seedToMnemonic(seedHex);
  if (!validateMnemonic(mnemonic)) {
    throw new Error('Generated mnemonic failed validation');
  }
  return mnemonic;
}
```

## Security Notes

### ⚠️ CRITICAL WARNINGS

1. **NEVER share your seed phrase** - Anyone with the seed has full control of your wallet

2. **NEVER commit seeds to version control** - Use `.env` files and add them to `.gitignore`

3. **NEVER hardcode seeds in code** - Always use environment variables:
   ```typescript
   // ❌ WRONG
   const seed = "word1 word2 ... word24";
   
   // ✅ CORRECT
   const seed = process.env.XNO_SEED;
   ```

4. **Store seeds securely** - Use:
   - Hardware wallets (Ledger, Trezor)
   - Password managers (1Password, Bitwarden)
   - Encrypted storage

5. **Write down seed offline** - For long-term storage, write the seed on paper or metal and store securely

### Best Practices

```bash
# .env file (add to .gitignore!)
XNO_SEED="your 24 word seed phrase here"

# .gitignore
.env
.env.local
*.env
```

```typescript
// config.ts
import dotenv from 'dotenv';

dotenv.config();

export const getSeed = (): string | undefined => {
  const seed = process.env.XNO_SEED;
  
  if (!seed) {
    console.warn('XNO_SEED not set in environment');
    return undefined;
  }
  
  return seed;
};
```

## Technical Details

### BIP-39 Mnemonic

- Uses 24-word BIP-39 mnemonic seed phrase
- Provides 256 bits of entropy
- Standard across cryptocurrency wallets

### BIP-44 Derivation Path

```
m/44'/165'/0'/0'/0
```

- `44'` - BIP-44 purpose
- `165'` - XNO coin type (registered SLIP-0044)
- `0'` - Account index
- `0` - Change (external)
- `0` - Address index

### Address Format

- Prefix: `xno_` (modern) or `nano_` (legacy)
- Base32 encoded public key
- Blake2b checksum

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid seed phrase` | Wrong word count or invalid words | Ensure exactly 24 valid BIP-39 words |
| `Invalid derivation` | Corrupted seed | Regenerate wallet |
| `Address mismatch` | Wrong derivation path | Use default BIP-44 path |

### Validation Example

```typescript
import { validateSeed, validateAddress } from 'xno';

// Validate seed before use
if (!validateSeed(userInput)) {
  throw new Error('Invalid seed: must be 24 BIP-39 words');
}

// Validate address format
if (!validateAddress(address)) {
  throw new Error('Invalid XNO address format');
}
```

## Examples

### Generate and Display (Development Only)

```bash
# Generate new wallet for testing
npx -y xno-skills wallet create --json | jq .

# Output:
# {
#   "seed": "abandon ... art",
#   "address": "xno_1abc..."
# }
```

### Script Integration

```bash
#!/bin/bash
# create-wallet.sh

WALLET=$(npx -y xno-skills wallet create --json)
ADDRESS=$(echo "$WALLET" | jq -r '.address')

echo "Wallet created: $ADDRESS"
echo "Seed stored securely in environment"
```

## Related Skills

- `validate-address` - Verify XNO address format
- `convert-units` - Convert between XNO denominations

## References

- [BIP-39 Mnemonic Code](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)
- [BIP-44 Multi-Account Hierarchy](https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki)
- [XNO Documentation](https://docs.nano.org)
