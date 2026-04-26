---
name: nano-convert-units
description: Convert between XNO units (raw/xno/knano/mnano) with exact BigInt precision.
triggers:
  - convert units
  - unit conversion
  - xno-skills convert
  - nano to xno
  - xno to nano
  - raw to xno
  - convert xno
  - knano conversion
  - mnano conversion
  - xno to raw
  - raw units
---

# Convert XNO Units

Convert between different XNO cryptocurrency units with BigInt precision. XNO uses 30 decimal places, making floating-point arithmetic unsafe. Always use this skill for accurate conversions.

## Unit Reference

| Unit | Raw Value | Decimal Places | Description |
|------|-----------|----------------|-------------|
| **raw** | 1 | 0 | Smallest unit (base unit) |
| **mnano** | 10^24 | 24 | Mega-nano (0.000001 XNO) |
| **knano** | 10^27 | 27 | Kilonano (0.001 XNO) |
| **XNO** | 10^30 | 30 | Base unit (1 XNO) |

### Conversion Factors

```
1 XNO    = 1,000 knano = 1,000,000 mnano = 10^30 raw
1 knano  = 1,000 mnano = 10^27 raw
1 mnano  = 10^24 raw
```

## CLI Usage

### Basic Syntax

```bash
npx xno-skills convert <amount> <from-unit> --to <to-unit>
```

### Examples

#### Convert XNO to raw

```bash
npx xno-skills convert 1 XNO --to raw
# Output: 1000000000000000000000000000000

npx xno-skills convert 0.5 XNO --to raw
# Output: 500000000000000000000000000000
```

#### Convert raw to XNO

```bash
npx xno-skills convert 1000000000000000000000000000000 raw --to XNO
# Output: 1

npx xno-skills convert 500000000000000000000000000000 raw --to XNO
# Output: 0.5
```

#### Convert XNO to knano

```bash
npx xno-skills convert 1 XNO --to knano
# Output: 1000

npx xno-skills convert 0.001 XNO --to knano
# Output: 1
```

#### Convert knano to XNO

```bash
npx xno-skills convert 1000 knano --to XNO
# Output: 1

npx xno-skills convert 1 knano --to XNO
# Output: 0.001
```

#### Convert XNO to mnano

```bash
npx xno-skills convert 1 XNO --to mnano
# Output: 1000000

npx xno-skills convert 0.000001 XNO --to mnano
# Output: 1
```

#### Convert mnano to XNO

```bash
npx xno-skills convert 1000000 mnano --to XNO
# Output: 1

npx xno-skills convert 1 mnano --to XNO
# Output: 0.000001
```

#### Convert between knano and mnano

```bash
npx xno-skills convert 1000 knano --to mnano
# Output: 1000000

npx xno-skills convert 1 mnano --to knano
# Output: 0.001
```

## Precision Handling

### Why BigInt?

XNO uses **30 decimal places**, which exceeds JavaScript's safe integer limit (15-17 digits). Floating-point arithmetic causes precision loss:

```javascript
// WRONG - Floating point loses precision
const wrong = 0.1 + 0.2; // 0.30000000000000004

// RIGHT - BigInt maintains precision
const correct = BigInt("1000000000000000000000000000000");
```

### Implementation Notes

1. **All conversions use BigInt internally** - No floating-point operations
2. **Input parsing** - Decimal strings converted to BigInt raw units
3. **Output formatting** - BigInt raw units converted to requested unit
4. **No precision loss** - Exact conversions for any amount

### Common Precision Pitfalls

```javascript
// DON'T use Number for XNO amounts
const wrong = 1.5; // Loses precision at 30 decimals

// DO use string input for CLI
// npx xno-skills convert "1.5" XNO --to raw
```

## Common Use Cases

### Wallet Balance Display

```bash
# Convert raw balance to human-readable XNO
npx xno-skills convert 500000000000000000000000000000 raw --to XNO
# Output: 0.5

# Convert to knano for smaller display
npx xno-skills convert 500000000000000000000000000000 raw --to knano
# Output: 500
```

### Transaction Amounts

```bash
# Send 0.001 XNO
npx xno-skills convert 0.001 XNO --to raw
# Output: 1000000000000000000000000000

# Send 1 knano
npx xno-skills convert 1 knano --to raw
# Output: 1000000000000000000000000000
```

### Fee Calculations

```bash
# Calculate fee in raw (e.g., 0.000001 XNO fee)
npx xno-skills convert 0.000001 XNO --to raw
# Output: 1000000000000000000000000

# Convert fee to mnano
npx xno-skills convert 0.000001 XNO --to mnano
# Output: 1
```

### Large Amounts

```bash
# Convert 1 million XNO to raw
npx xno-skills convert 1000000 XNO --to raw
# Output: 1000000000000000000000000000000000000

# Convert large raw amount to XNO
npx xno-skills convert 1000000000000000000000000000000000000 raw --to XNO
# Output: 1000000
```

## Validation

### Input Validation

- Amount must be a valid number (integer or decimal)
- Unit must be one of: `raw`, `XNO`, `knano`, `mnano`
- Negative amounts are supported

### Error Handling

```bash
# Invalid unit
npx xno-skills convert 1 XNO --to bitcoin
# Error: Unknown unit 'bitcoin'. Valid units: raw, XNO, knano, mnano

# Invalid amount
npx xno-skills convert abc XNO --to raw
# Error: Invalid amount 'abc'. Must be a valid number.
```

## Quick Reference

```bash
# Most common conversions
npx xno-skills convert 1 XNO --to raw          # 10^30 raw
npx xno-skills convert 1 XNO --to knano        # 1000 knano
npx xno-skills convert 1 XNO --to mnano        # 1000000 mnano
npx xno-skills convert 1 knano --to XNO        # 0.001 XNO
npx xno-skills convert 1 mnano --to XNO        # 0.000001 XNO
npx xno-skills convert 1 raw --to XNO          # 0.000000000000000000000000000001 XNO
```

## Related Skills

- **create-wallet** - Generate XNO wallet with seed phrase
- **validate-address** - Validate XNO addresses (BIP-44, legacy)
