---
name: Validate XNO Address
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

Validates XNO (Nano) cryptocurrency addresses offline. No network connection required - all validation is local.

## Address Format

Nano addresses follow a specific format:

```
[nano_|xrb_][60 characters]
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

Addresses use Base32 encoding with these characters:
- Lowercase letters: `a-z` (excluding confusing chars)
- Digits: `1-9` (no `0` to avoid confusion with `O`)
- Total: 32 characters in the alphabet

## CLI Validation

```bash
npx xno-skills validate <address>
```

Or via QR generation (also validates):

```bash
npx xno-skills qr <address>
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
nano_1xrb1e5trbbd1hqk8z9mjtm4mpn6j7f7x6b6e6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b
xrb_1xrb1e5trbbd1hqk8z9mjtm4mpn6j7f7x6b6e6b6b6b6b6b6b6b6b6b6b6b6b6b6b6b
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
| `Invalid characters` | Contains characters outside Base32 alphabet |
| `Invalid checksum` | Checksum doesn't match the public key |

## When to Use

- Before sending XNO to verify recipient address
- When displaying addresses in UI
- During wallet import/recovery
- In scripts that process addresses
