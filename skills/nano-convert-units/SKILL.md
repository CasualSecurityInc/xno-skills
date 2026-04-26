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

> **CLI Execution Priority**: Do not assume `xno-skills` or `ows` are installed globally. When executing CLI commands, always use the following order of priority to ensure successful execution:
> 1. `bunx -y <command>`
> 2. `pnpm dlx <command>`
> 3. `npx -y <command>`
> 
> *Example:* `bunx -y ows wallet list` or `bunx -y xno-skills rpc account-balance <address>`

> **Safety & Best Practices**:
> - **State Verification:** Always verify an account's state (balance and frontier) via RPC before manually building a block. Do not hallucinate previous hashes.
> - **Command Discovery:** Always use `--help` (e.g., `bunx -y xno-skills --help`) before guessing CLI subcommands to avoid 'unknown command' errors.
> - **Prefer MCP Tools:** Use built-in MCP tools (like `wallet_send`) for complex workflows unless the user explicitly demands the "raw" manual CLI path.
> - **PoW Validation:** Remember that a signed block without valid Proof of Work (PoW) cannot be broadcast. Ensure PoW is generated.
> - **Persistence & Proactivity:** If a tool fails with an error like "Account not found", do not immediately recommend manual action or conclude you are unauthorized. Troubleshoot the protocol state (e.g., check for pending funds) and use the correct tool for that state (e.g., `wallet_receive` to open an account).
> - **No Custom Scripts:** NEVER write custom Node.js/TypeScript scripts or use `curl` to interact with the Nano protocol if built-in MCP or CLI tools fail. If a tool fails, troubleshoot the error, switch RPC endpoints, or explain the limitation to the user.

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
bunx -y xno-skills convert <amount> <from-unit> --to <to-unit>
```

### Examples

#### Convert XNO to raw

```bash
bunx -y xno-skills convert 1 XNO --to raw
# Output: 1000000000000000000000000000000

bunx -y xno-skills convert 0.5 XNO --to raw
# Output: 500000000000000000000000000000
```

#### Convert raw to XNO

```bash
bunx -y xno-skills convert 1000000000000000000000000000000 raw --to XNO
# Output: 1

bunx -y xno-skills convert 500000000000000000000000000000 raw --to XNO
# Output: 0.5
```

#### Convert XNO to knano

```bash
bunx -y xno-skills convert 1 XNO --to knano
# Output: 1000

bunx -y xno-skills convert 0.001 XNO --to knano
# Output: 1
```

#### Convert knano to XNO

```bash
bunx -y xno-skills convert 1000 knano --to XNO
# Output: 1

bunx -y xno-skills convert 1 knano --to XNO
# Output: 0.001
```

#### Convert XNO to mnano

```bash
bunx -y xno-skills convert 1 XNO --to mnano
# Output: 1000000

bunx -y xno-skills convert 0.000001 XNO --to mnano
# Output: 1
```

#### Convert mnano to XNO

```bash
bunx -y xno-skills convert 1000000 mnano --to XNO
# Output: 1

bunx -y xno-skills convert 1 mnano --to XNO
# Output: 0.000001
```

#### Convert between knano and mnano

```bash
bunx -y xno-skills convert 1000 knano --to mnano
# Output: 1000000

bunx -y xno-skills convert 1 mnano --to knano
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
// bunx -y xno-skills convert "1.5" XNO --to raw
```

## Common Use Cases

### Wallet Balance Display

```bash
# Convert raw balance to human-readable XNO
bunx -y xno-skills convert 500000000000000000000000000000 raw --to XNO
# Output: 0.5

# Convert to knano for smaller display
bunx -y xno-skills convert 500000000000000000000000000000 raw --to knano
# Output: 500
```

### Transaction Amounts

```bash
# Send 0.001 XNO
bunx -y xno-skills convert 0.001 XNO --to raw
# Output: 1000000000000000000000000000

# Send 1 knano
bunx -y xno-skills convert 1 knano --to raw
# Output: 1000000000000000000000000000
```

### Fee Calculations

```bash
# Calculate fee in raw (e.g., 0.000001 XNO fee)
bunx -y xno-skills convert 0.000001 XNO --to raw
# Output: 1000000000000000000000000

# Convert fee to mnano
bunx -y xno-skills convert 0.000001 XNO --to mnano
# Output: 1
```

### Large Amounts

```bash
# Convert 1 million XNO to raw
bunx -y xno-skills convert 1000000 XNO --to raw
# Output: 1000000000000000000000000000000000000

# Convert large raw amount to XNO
bunx -y xno-skills convert 1000000000000000000000000000000000000 raw --to XNO
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
bunx -y xno-skills convert 1 XNO --to bitcoin
# Error: Unknown unit 'bitcoin'. Valid units: raw, XNO, knano, mnano

# Invalid amount
bunx -y xno-skills convert abc XNO --to raw
# Error: Invalid amount 'abc'. Must be a valid number.
```

## Quick Reference

```bash
# Most common conversions
bunx -y xno-skills convert 1 XNO --to raw          # 10^30 raw
bunx -y xno-skills convert 1 XNO --to knano        # 1000 knano
bunx -y xno-skills convert 1 XNO --to mnano        # 1000000 mnano
bunx -y xno-skills convert 1 knano --to XNO        # 0.001 XNO
bunx -y xno-skills convert 1 mnano --to XNO        # 0.000001 XNO
bunx -y xno-skills convert 1 raw --to XNO          # 0.000000000000000000000000000001 XNO
```

## Related Skills

- **nano-create-wallet** - Generate XNO wallet with seed phrase
- **nano-validate-address** - Validate XNO addresses (BIP-44, legacy)
