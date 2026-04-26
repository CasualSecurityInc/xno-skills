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

Validates XNO (Nano) cryptocurrency addresses offline. No network connection required - all validation is local.

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
