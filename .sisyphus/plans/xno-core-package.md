# XNO Core Package - NPM Package for Nano Cryptocurrency

## TL;DR

> **Quick Summary**: Build 'xno' - a production-grade NPM package enabling seamless Nano ($XNO) cryptocurrency interactions for LLMs/AI agents and developers. Security-first, precision-accurate, minimal dependencies.
>
> **Deliverables**:
> - `xno` npm package with offline wallet operations (seed generation, address derivation, unit conversions, ASCII QR)
> - CLI via `npx xno wallet create|convert|qr`
> - Skills integration via `xno-skills` repo for agent compatibility
> - Optional MCP server for API access
>
> **Estimated Effort**: Large (multi-component, crypto precision critical)
> **Parallel Execution**: YES - 5-7 tasks per wave
> **Critical Path**: Core crypto functions → Address derivation → Unit conversions → QR generation → CLI → Skills

---

## Context

### Original Request
Create a comprehensive Nano cryptocurrency package called 'xno' for NPM. The package should:
- Enable "fully Nano-capable" agents/chats with wallet management, unit conversions, and RPC access
- Prioritize security (hex seeds/mnemonics out of chat logs, use platform keychains)
- Handle precision correctly (BigInt internally, strings for I/O, never JS Number)
- Support offline operations (core) vs online operations (RPC) separation
- Provide CLI support via `npx xno [subcommand]`
- Enable MCP server for hosted/API use
- Create skills repo for agent compatibility (Vercel skills CLI)

### Interview Summary
**Key Discussions**:
- Package name 'xno' is confirmed available on NPM (three-letter package)
- Target primary users: LLMs/agents needing Nano for allowances/funding
- Target secondary users: Developers building Nano integrations
- Security: Seeds/mnemonics must never appear in chat logs; use env vars, vaults, or ephemeral storage
- Precision: JavaScript Number silently truncates; must use BigInt for raw units (10^30 per XNO)
- Modularity: Separate offline (wallet, conversions) from online (RPC) due to different configs

**Research Findings**:
- **nano-to/nano-js**: Zero-dependency Nano wallet with vendored nanocurrency-web-js, crypto-js for AES-256
- **Nano cryptography**: Ed25519 for signatures, Blake2b-256 for hashing, custom nano-base32 encoding
- **Skills pattern**: YAML frontmatter SKILL.md files, `npx skills add owner/repo`
- **MCP protocol**: Open standard for AI tool integration, TypeScript SDK available
- **Address format**: `nano_` + 60 chars (52 for public key + 8 for checksum)
- **Derivation paths**: Legacy Blake2b path + BIP44 (`m/44'/165'/0'`)

### Metis Review
**Identified Gaps** (addressed):
- **Nano-base32 encoding**: Custom charset excluding ambiguous chars (0OIl2x), ~50 lines to implement
- **Block structure/work**: Deferred to v0.2.0 - CPU-bound, not needed for offline ops
- **Signature algorithm**: Ed25519 with Blake2b-512 (not SHA-512)
- **Test vectors**: Must use official Nano test vectors for validation

**Guardrails Applied**:
- Start with offline-only features (no network dependency)
- BigInt everywhere for amounts, never Number
- Support both legacy and BIP44 derivation paths
- Skills before MCP (lower barrier, faster delivery)

---

## Work Objectives

### Core Objective
Deliver a production-ready 'xno' npm package that LLMs/agents can use to generate Nano wallets, derive addresses, convert units with precision, and display QR codes - all without requiring prior Nano knowledge.

### Concrete Deliverables
- `xno` npm package (v0.1.0)
  - Core library (ESM + CJS builds)
  - TypeScript type definitions
  - CLI (`npx xno`)
- `xno-skills` GitHub repo
  - Agent-compatible skills for wallet creation, address validation, unit conversion
  - Installable via `npx skills add casualsecurity/xno-skills`
- Optional (v0.2.0+): MCP server, xno-rpc package

### Definition of Done
- [ ] All core functions pass test vectors from Nano documentation
- [ ] BigInt precision validated (1 XNO + 1e-30 XNO = 1000000000000000000000000000001 raw)
- [ ] CLI works via `npx -y xno wallet create`
- [ ] Skills installable and functional in Claude Code / Cursor
- [ ] No seeds/mnemonics logged to console in any function
- [ ] TypeScript types exported correctly
- [ ] MIT LICENSE, comprehensive README

### Must Have
- Cryptographically secure seed generation (32-byte hex)
- BIP39 mnemonic support (12/24 word phrases)
- Address derivation (legacy Blake2b + BIP44 paths)
- Address validation with checksum verification
- Unit conversions (raw, XNO, knano, mnano) with BigInt precision
- ASCII QR code generation
- CLI with wallet create/convert/qr subcommands
- All offline operations (no network calls in core)

### Must NOT Have (Guardrails from Metis)
- NO JavaScript Number usage for amounts (silent truncation)
- NO logging of seeds/mnemonics to any output
- NO network calls in core library (offline-only)
- NO floating-point arithmetic for conversions
- NO block/work generation in v0.1.0 (deferred)
- NO transaction signing/broadcasting (v0.2.0+)

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (new project)
- **Automated tests**: YES (TDD with vitest)
- **Framework**: vitest
- **TDD Workflow**: RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Core Library**: Use vitest - Import functions, call with test vectors, assert outputs
- **CLI**: Use Bash (npx) - Run commands, capture stdout/stderr, assert exit codes
- **QR Output**: Use Bash - Run command, validate ASCII output contains expected patterns
- **Skills**: Use Bash - Install skill, verify SKILL.md structure

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + crypto primitives):
├── Task 1: Project scaffolding + TypeScript config [quick]
├── Task 2: Nano-base32 encoding implementation [deep]
├── Task 3: Blake2b hash utilities [quick]
├── Task 4: Seed generation (hex + BIP39 mnemonic) [deep]
├── Task 5: Address derivation (legacy path) [deep]
├── Task 6: Address validation + checksum [quick]
└── Task 7: Unit conversion utilities (raw/XNO/knano/mnano) [quick]

Wave 2 (After Wave 1 — integration + QR):
├── Task 8: Address derivation BIP44 path [deep]
├── Task 9: QR code generation (ASCII terminal) [visual-engineering]
├── Task 10: CLI framework setup (commander) [quick]
├── Task 11: CLI: wallet create command [quick]
├── Task 12: CLI: convert command [quick]
├── Task 13: CLI: qr command [quick]
└── Task 14: ESM + CJS build configuration [quick]

Wave 3 (After Wave 2 — skills + polish):
├── Task 15: Skills repo structure [quick]
├── Task 16: Skill: create-wallet [unspecified-high]
├── Task 17: Skill: convert-units [unspecified-high]
├── Task 18: Skill: validate-address [unspecified-high]
├── Task 19: Package exports + README [writing]
├── Task 20: Test vectors validation [deep]
└── Task 21: Security audit + SECURITY.md [deep]

Wave FINAL (After ALL tasks — verification):
├── Task F1: Plan compliance audit (oracle) [oracle]
├── Task F2: Code quality review (unspecified-high)
├── Task F3: CLI functional QA (unspecified-high)
└── Task F4: Skills integration test (unspecified-high)

Critical Path: Task 1 → Task 2 → Task 5 → Task 8 → Task 9 → Task 10 → Task 21 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 7 (Waves 1 & 2)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|------------|--------|
| 1 | — | 2-7, 10-21 |
| 2 | 1 | 5, 6 |
| 3 | 1 | 2, 4 |
| 4 | 1, 3 | 5, 8, 11 |
| 5 | 1, 2, 3 | 6, 8, 9, 11 |
| 6 | 2, 5 | 11, 16 |
| 7 | — | 12, 17 |
| 8 | 4, 5 | 9, 11 |
| 9 | 5, 6 | 13 |
| 10 | 1 | 11-14 |
| 11 | 4, 5, 8, 10 | 16 |
| 12 | 7, 10 | 17 |
| 13 | 9, 10 | 18 |
| 14 | 1-13 | 15-21 |
| 15 | 14 | 16-18 |
| 16 | 6, 11, 15 | F4 |
| 17 | 7, 12, 15 | F4 |
| 18 | 6, 13, 15 | F4 |
| 19 | 14 | — |
| 20 | 1-7 | F1-F3 |
| 21 | 1-20 | F1-F4 |

### Agent Dispatch Summary

- **Wave 1**: 7 tasks — T1-T4 → quick, T5-T7 → deep
- **Wave 2**: 7 tasks — T8, T11-T14, T16-18 → quick, T9 → visual-engineering, T10-T14 → quick
- **Wave 3**: 7 tasks — T15-T16, T18 → high, T17, T19-20 → writing/deep
- **FINAL**: 4 tasks — F1 → oracle, F2-F4 → unspecified-high

---

## TODOs

- [x] 1. Project Scaffolding + TypeScript Configuration

  **What to do**:
  - Initialize npm package with `npm init -y`
  - Create TypeScript configuration (tsconfig.json)
  - Set up project structure: `src/`, `dist/`, `test/`
  - Configure package.json for ESM + CJS dual builds
  - Add .gitignore, LICENSE (MIT), README.md skeleton
  - Set up vitest for testing

  **Must NOT do**:
  - NO source code implementation (just scaffolding)
  - NO dependencies beyond TypeScript + vitest setup

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (basic setup)
  - **Skills Evaluated but Omitted**: All domain-specific skills (no implementation)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (foundation)
  - **Blocks**: Tasks 2-7, 10-21
  - **Blocked By**: None

  **References**:
  - `package.json` (to be created) - NPM package configuration
  - `tsconfig.json` (to be created) - TypeScript compiler options
  - External: https://www.typescriptlang.org/tsconfig - TypeScript config docs

  **Acceptance Criteria**:
  - [ ] `package.json` exists with name "xno", version "0.1.0", MIT license
  - [ ] `tsconfig.json` configured for ESM + declarations
  - [ ] Directory structure created: `src/`, `dist/`, `test/`
  - [ ] `.gitignore` includes `node_modules/`, `dist/`, `*.log`
  - [ ] `npm install && npm test` runs without errors (empty test suite passes)

  **QA Scenarios**:

  Scenario: Project structure validation
    Tool: Bash
    Preconditions: Fresh clone, no node_modules
    Steps:
      1. `npm install` → exit code 0
      2. `ls -la src/ dist/ test/` → all directories exist
      3. `cat package.json | grep '"name"' | grep 'xno'` → found
      4. `cat tsconfig.json | grep '"module"' | grep 'ESNext'` → found
    Expected Result: All files and directories present, valid JSON configs
    Failure Indicators: Missing directories, invalid JSON, wrong package name
    Evidence: .sisyphus/evidence/task-01-structure-validation.txt

  **Commit**: YES (initial commit)
  - Message: `feat: initialize xno package scaffolding`
  - Files: package.json, tsconfig.json, .gitignore, LICENSE, README.md
  - Pre-commit: none

---

- [ ] 2. Nano-Base32 Encoding Implementation

  **What to do**:
  - Implement custom Base32 encoding/decoding for Nano addresses
  - Character set: `13456789abcdefghijkmnopqrstuwxyz` (excludes 0OIl2x)
  - Encoding: Take 5-bit chunks, map to charset
  - Decoding: Reverse process with validation
  - Add comprehensive unit tests with Nano address test vectors
  - Export functions: `base32Encode(bytes: Uint8Array): string`, `base32Decode(str: string): Uint8Array`

  **Must NOT do**:
  - NO standard RFC4648 Base32 (wrong charset)
  - NO external base32 library imports (implement from scratch)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]` (self-contained crypto primitive)
  - **Skills Evaluated but Omitted**: All (algorithmic implementation)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1 (with Tasks 3-7)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: Task 1 (scaffolding)

  **References**:
  - External: https://docs.nano.org/integration-guides/the-basics/#account-public-address-derivation
  - External: Nano character set excludes ambiguous: 0 (zero), O (ou), I (i), l (el), 2, x
  - Example Nano address: `nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs`

  **Acceptance Criteria**:
  - [ ] `base32Encode(new Uint8Array([0x00]))` returns '1' (first char)
  - [ ] `base32Decode('1')` returns `Uint8Array([0x00])`
  - [ ] Encoding/decoding roundtrip works for all Nano addresses
  - [ ] Invalid characters throw descriptive error
  - [ ] 100% test coverage for encoding/decoding functions

  **QA Scenarios**:

  Scenario: Encode/decode roundtrip
    Tool: vitest
    Preconditions: Task 1 complete, functions implemented
    Steps:
      1. Import base32Encode, base32Decode from src/base32.ts
      2. Test: `const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03])`
      3. `const encoded = base32Encode(bytes)`
      4. `const decoded = base32Decode(encoded)`
      5. `assert.deepEqual(decoded, bytes)`
    Expected Result: Roundtrip produces identical bytes
    Failure Indicators: Mismatched bytes, undefined output, exception
    Evidence: .sisyphus/evidence/task-02-roundtrip.test.ts

  Scenario: Invalid character rejection
    Tool: vitest
    Preconditions: Decode function implemented
    Steps:
      1. `base32Decode('abc0def')` (contains '0')
      2. Expect: throws Error with 'invalid character'
    Expected Result: Throws descriptive error
    Failure Indicators: No error, silent failure, wrong error type
    Evidence: .sisyphus/evidence/task-02-invalid-char.test.ts

  **Commit**: YES
  - Message: `feat: implement nano-base32 encoding`
  - Files: src/base32.ts, test/base32.test.ts
  - Pre-commit: `npm test`

---

- [ ] 3. Blake2b Hash Utilities

  **What to do**:
  - Implement Blake2b hash function wrapper using @noble/hashes
  - Export functions: `blake2b256(data: Uint8Array): Uint8Array`, `blake2b512(data: Uint8Array): Uint8Array`
  - Add convenience function for hex encoding: `blake2b256Hex(data: Uint8Array): string`
  - Unit tests with known test vectors
  - Document that Nano uses Blake2b-512 for signatures, Blake2b-256 for hashes

  **Must NOT do**:
  - NO SHA-256/SHA-512 usage (wrong algorithm)
  - NO custom Blake2b implementation (use @noble/hashes)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (wrapper around existing library)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 2, 4, 5
  - **Blocked By**: Task 1

  **References**:
  - External: https://github.com/paulmillr/noble-hashes#blake2b
  - External: https://docs.nano.org/integration-guides/the-basics/#account-public-address-derivation
  - Dependency: `@noble/hashes` v1.3.0+

  **Acceptance Criteria**:
  - [ ] `blake2b256(new Uint8Array(32))` returns 32-byte hash
  - [ ] `blake2b512(new Uint8Array(32))` returns 64-byte hash
  - [ ] Test vectors from Nano docs pass
  - [ ] Hex encoding function works correctly

  **QA Scenarios**:

  Scenario: Hash output size
    Tool: vitest
    Preconditions: Blake2b functions implemented
    Steps:
      1. `const hash256 = blake2b256(new Uint8Array(32))`
      2. `assert(hash256.length === 32)`
      3. `const hash512 = blake2b512(new Uint8Array(32))`
      4. `assert(hash512.length === 64)`
    Expected Result: Correct output lengths
    Failure Indicators: Wrong length, undefined, exception
    Evidence: .sisyphus/evidence/task-03-hash-length.test.ts

  **Commit**: YES
  - Message: `feat: add blake2b hash utilities`
  - Files: src/blake2b.ts, test/blake2b.test.ts
  - Pre-commit: `npm test`

---

- [ ] 4. Seed Generation (Hex + BIP39 Mnemonic)

  **What to do**:
  - Implement cryptographically secure 32-byte seed generation
  - Use `crypto.randomBytes` (Node.js) or `crypto.getRandomValues` (browser)
  - Add BIP39 mnemonic conversion using @scure/bip39
  - Support both 12-word (128-bit entropy) and 24-word (256-bit entropy) mnemonics
  - Export functions: `generateSeed(): string`, `seedToMnemonic(seed: string): string`, `mnemonicToSeed(mnemonic: string): string`
  - NEVER log seeds/mnemonics to console

  **Must NOT do**:
  - NO Math.random() usage (not cryptographically secure)
  - NO console.log of seeds or mnemonics
  - NO Node.js-specific APIs without browser fallback

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]` (crypto security critical)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 1, 3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 5, 8, 11
  - **Blocked By**: Task 1, Task 3 (for hashes)

  **References**:
  - External: https://github.com/paulmillr/scure-bip39
  - External: BIP39 wordlist validation requirements
  - Security: Must zero buffers after use with `buffer.fill(0)`

  **Acceptance Criteria**:
  - [ ] `generateSeed()` returns 64-char hex string (32 bytes)
  - [ ] `seedToMnemonic(seed)` returns 24-word phrase
  - [ ] `mnemonicToSeed(mnemonic)` roundtrips correctly
  - [ ] Invalid mnemonic words throw error
  - [ ] No seeds/mnemonics in any console output

  **QA Scenarios**:

  Scenario: Seed entropy quality
    Tool: vitest
    Preconditions: Seed generation implemented
    Steps:
      1. Generate 100 seeds: `Array(100).fill(0).map(() => generateSeed())`
      2. Check all are unique: `new Set(seeds).size === 100`
      3. Check all are 64-char hex: `seeds.every(s => /^[0-9a-f]{64}$/.test(s))`
    Expected Result: All seeds unique and valid format
    Failure Indicators: Duplicate seeds, wrong length, invalid chars
    Evidence: .sisyphus/evidence/task-04-entropy.test.ts

  Scenario: Mnemonic roundtrip
    Tool: vitest
    Preconditions: Mnemonic functions implemented
    Steps:
      1. `const seed = '0000000000000000000000000000000000000000000000000000000000000001'`
      2. `const mnemonic = seedToMnemonic(seed)`
      3. `const recovered = mnemonicToSeed(mnemonic)`
      4. `assert(recovered === seed)`
    Expected Result: Seed recovered exactly
    Failure Indicators: Different seed, exception, wrong word count
    Evidence: .sisyphus/evidence/task-04-mnemonic-roundtrip.test.ts

  **Commit**: YES
  - Message: `feat: implement seed generation and BIP39 mnemonic support`
  - Files: src/seed.ts, test/seed.test.ts
  - Pre-commit: `npm test`

---

- [ ] 5. Address Derivation (Legacy Blake2b Path)

  **What to do**:
  - Implement address derivation using legacy Nano path (Blake2b-based)
  - Path: `PrivK[i] = blake2b(seed || i, 32)` where `i` is 32-bit big-endian uint
  - Public key: Ed25519 from private key
  - Address: Apply nano-base32 encoding with checksum
  - Export: `deriveAddressLegacy(seed: string, index: number): { address: string; publicKey: string; privateKey: string }`
  - Use official Nano test vectors for validation

  **Must NOT do**:
  - NO BIP44 path (separate task)
  - NO network calls (offline only)
  - NO seed logging in error messages

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]` (crypto implementation)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 1, 2, 3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 6, 8, 9, 11
  - **Blocked By**: Task 1, Task 2, Task 3

  **References**:
  - External: https://docs.nano.org/integration-guides/key-management/#hierarchical-deterministic-wallets
  - External: https://docs.nano.org/integration-guides/the-basics/#account-public-address-derivation
  - Test Vector: seed `0...01` → address `nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs`

  **Acceptance Criteria**:
  - [ ] `deriveAddressLegacy('00...01', 0)` returns correct Nano address
  - [ ] Index parameter works for index 0, 1, 100
  - [ ] Address checksum is valid (passes validation)
  - [ ] Private key is 64-char hex
  - [ ] Public key is 64-char hex

  **QA Scenarios**:

  Scenario: Known test vector match
    Tool: vitest
    Preconditions: Derivation implemented
    Steps:
      1. `const result = deriveAddressLegacy('0000000000000000000000000000000000000000000000000000000000000001', 0)`
      2. `assert(result.address === 'nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs')`
      3. `assert(result.privateKey.length === 64)`
      4. `assert(result.publicKey.length === 64)`
    Expected Result: Exact match to Nano test vector
    Failure Indicators: Wrong address, wrong key lengths
    Evidence: .sisyphus/evidence/task-05-test-vector.test.ts

  Scenario: Multiple indices produce different addresses
    Tool: vitest
    Preconditions: Derivation implemented
    Steps:
      1. `const addr0 = deriveAddressLegacy(seed, 0)`
      2. `const addr1 = deriveAddressLegacy(seed, 1)`
      3. `assert(addr0.address !== addr1.address)`
    Expected Result: Different addresses for different indices
    Failure Indicators: Same address for different indices
    Evidence: .sisyphus/evidence/task-05-indices.test.ts

  **Commit**: YES
  - Message: `feat: implement legacy address derivation`
  - Files: src/address-legacy.ts, test/address-legacy.test.ts
  - Pre-commit: `npm test`

---

- [ ] 6. Address Validation + Checksum

  **What to do**:
  - Implement Nano address validation
  - Verify `nano_` or `xrb_` prefix
  - Validate length (5 + 60 = 65 chars)
  - Decode base32, extract checksum, verify with Blake2b-40
  - Checksum algorithm: `blake2b(publicKey, null, 5).reverse()` then encode
  - Export: `validateAddress(address: string): { valid: boolean; publicKey?: string; error?: string }`

  **Must NOT do**:
  - NO network validation (offline only)
  - NO signature verification (future work)
  - NO modification of input address

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (uses existing base32)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 2, 5)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 11, 16, 18
  - **Blocked By**: Task 2, Task 5

  **References**:
  - External: https://docs.nano.org/integration-guides/the-basics/#account-public-address-derivation
  - Checksum: Blake2b-40 (5 bytes), reversed before encoding

  **Acceptance Criteria**:
  - [ ] Valid address passes: `validateAddress('nano_1anrz...')` → `{ valid: true }`
  - [ ] Invalid checksum fails with error message
  - [ ] Wrong prefix fails with descriptive error
  - [ ] Wrong length fails with descriptive error
  - [ ] Extracts public key from valid address

  **QA Scenarios**:

  Scenario: Valid address acceptance
    Tool: vitest
    Preconditions: Validation implemented
    Steps:
      1. `const result = validateAddress('nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs')`
      2. `assert(result.valid === true)`
      3. `assert(result.publicKey.length === 64)`
    Expected Result: Validation passes, public key extracted
    Failure Indicators: `valid: false`, no public key
    Evidence: .sisyphus/evidence/task-06-valid-address.test.ts

  Scenario: Invalid checksum rejection
    Tool: vitest
    Preconditions: Validation implemented
    Steps:
      1. `const result = validateAddress('nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrt')`
      2. (Note: last char changed)
      3. `assert(result.valid === false)`
      4. `assert(result.error.includes('checksum'))`
    Expected Result: Validation fails with checksum error
    Failure Indicators: `valid: true`, no error message
    Evidence: .sisyphus/evidence/task-06-invalid-checksum.test.ts

  **Commit**: YES
  - Message: `feat: implement address validation with checksum`
  - Files: src/validate.ts, test/validate.test.ts
  - Pre-commit: `npm test`

---

- [ ] 7. Unit Conversion Utilities

  **What to do**:
  - Implement precise unit conversions using BigInt
  - Supported units: raw (base unit), XNO (Nano), knano, mnano
  - 1 XNO = 10^30 raw (30 decimal places)
  - 1 knano = 10^3 XNO, 1 mnano = 10^6 XNO
  - Export: `nanoToRaw(nano: string): string`, `rawToNano(raw: string, decimals?: number): string`, `formatNano(raw: string): string`
  - Handle edge cases: "1" → "1000000000000000000000000000000"

  **Must NOT do**:
  - NO JavaScript Number for amounts (silent truncation)
  - NO floating-point arithmetic
  - NO rounding without explicit parameter

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (BigInt math only)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 12, 17
  - **Blocked By**: None

  **References**:
  - Precision: 1 raw = 10^-30 XNO
  - BigInt always, strings for I/O

  **Acceptance Criteria**:
  - [ ] `nanoToRaw('1')` returns `1000000000000000000000000000000` (exact)
  - [ ] `nanoToRaw('1.000000000000000000000000000001')` preserves all 30 decimals
  - [ ] `rawToNano('1000000000000000000000000000000')` returns `'1'`
  - [ ] `rawToNano('1')` returns `'0.000...001'` (30 decimal places)
  - [ ] `formatNano('1330000000000000000000000000000')` returns `'1.33 XNO'`

  **QA Scenarios**:

  Scenario: Precision preservation
    Tool: vitest
    Preconditions: Conversion functions implemented
    Steps:
      1. `const raw = nanoToRaw('1.000000000000000000000000000001')`
      2. `assert(raw === '1000000000000000000000000000001')`
      3. `const back = rawToNano(raw)`
      4. `assert(back === '1.000000000000000000000000000001')`
    Expected Result: Perfect roundtrip without precision loss
    Failure Indicators: Different value, truncation, rounding
    Evidence: .sisyphus/evidence/task-07-precision.test.ts

  Scenario: Edge case handling
    Tool: vitest
    Preconditions: Conversion implemented
    Steps:
      1. `nanoToRaw('0')` → `'0'`
      2. `nanoToRaw('0.000000000000000000000000000001')` → `'1'`
      3. `rawToNano('1')` → `'0.000000000000000000000000000001'`
      4. `rawToNano('0')` → `'0'`
    Expected Result: Edge cases handled correctly
    Failure Indicators: Wrong values, exceptions
    Evidence: .sisyphus/evidence/task-07-edges.test.ts

  **Commit**: YES
  - Message: `feat: implement precise unit conversions with BigInt`
  - Files: src/convert.ts, test/convert.test.ts
  - Pre-commit: `npm test`

---

- [ ] 8. Address Derivation BIP44 Path

  **What to do**:
  - Implement BIP32/BIP44 derivation path for Nano
  - Path: `m/44'/165'/[address_index]'` (coin_type 165)
  - Use SLIP-0010 for Ed25519 with hardened keys
  - Add test vectors matching other wallet implementations
  - Export: `deriveAddressBIP44(mnemonic: string, index: number): { address: string; publicKey: string; privateKey: string }`

  **Must NOT do**:
  - NO non-hardened derivation (Ed25519 doesn't support it)
  - NO custom path (stick to BIP44 standard)

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]` (BIP32/BIP44 implementation)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 4, 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 9, 11
  - **Blocked By**: Task 4, Task 5

  **References**:
  - External: https://github.com/satoshilabs/slips/blob/master/slip-0010.md
  - Coin type: 165 (Nano registered coin type)
  - HMAC key: `"ed25519 seed"` per SLIP-0010

  **Acceptance Criteria**:
  - [ ] BIP44 derivation produces valid Nano addresses
  - [ ] Index parameter works for index 0, 1, 100
  - [ ] Matches reference wallet implementations
  - [ ] Compatible with existing Nano wallets using BIP44

  **QA Scenarios**:

  Scenario: BIP44 test vector match
    Tool: vitest
    Preconditions: BIP44 derivation implemented
    Steps:
      1. Use known mnemonic: `"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon diesel"`
      2. `const result = deriveAddressBIP44(mnemonic, 0)`
      3. Verify address matches expected Nano address for this mnemonic
      4. Verify index 1 produces different address
    Expected Result: Matches reference wallet
    Failure Indicators: Wrong address format, same address for different indices
    Evidence: .sisyphus/evidence/task-08-bip44-vector.test.ts

  **Commit**: YES
  - Message: `feat: implement BIP44 address derivation`
  - Files: src/address-bip44.ts, test/address-bip44.test.ts
  - Pre-commit: `npm test`

---

- [ ] 9. QR Code Generation (ASCII Terminal)

  **What to do**:
  - Implement ASCII QR code generation for addresses
  - Use `qrcode-terminal` library (minimal deps)
  - Support nano: URI scheme with optional amount parameter
  - Generate monospaced ASCII output for terminal display
  - Export: `generateAsciiQr(address: string, amount?: string): string`
  - CLI: `xno qr nano_... --amount 1.5`

  **Must NOT do**:
  - NO PNG/image generation (ASCII only)
  - NO network calls (offline)
  - NO amount validation (lega to caller)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: `[]` (QR library integration)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 5, 6, 8)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 13
  - **Blocked By**: Task 5, Task 6

  **References**:
  - Library: `qrcode-terminal` v0.12.0
  - URI scheme: `nano:address?amount=raw`

  **Acceptance Criteria**:
  - [ ] `generateAsciiQr('nano_1...')` returns ASCII string
  - [ ] QR contains correct address URI
  - [ ] Amount parameter is encoded in URI
  - [ ] QR is scannable with mobile wallet

  **QA Scenarios**:

  Scenario: QR generation output
    Tool: vitest
    Preconditions: QR function implemented
    Steps:
      1. `const qr = generateAsciiQr('nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs')`
      2. `assert(qr.includes('██'))` (contains QR blocks)
      3. Verify QR is non-empty string
    Expected Result: ASCII QR output
    Failure Indicators: Empty string, exception
    Evidence: .sisyphus/evidence/task-09-qr-output.test.ts

  Scenario: QR with amount parameter
    Tool: Bash
    Preconditions: CLI implemented
    Steps:
      1. `npx xno qr nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs --amount 1.5`
      2. Capture output
      3. Scan QR with Nano wallet app (manual verification)
    Expected Result: QR encodes `nano:address?amount=...`
    Failure Indicators: QR doesn't scan, wrong URI format
    Evidence: .sisyphus/evidence/task-09-qr-amount.txt

  **Commit**: YES
  - Message: `feat: implement ASCII QR code generation`
  - Files: src/qr.ts, test/qr.test.ts
  - Pre-commit: `npm test`

---

- [ ] 10. CLI Framework Setup

  **What to do**:
  - Set up CLI using `commander` package
  - Define command structure: `xno wallet create|from-mnemonic`, `xno convert`, `xno qr`, `xno validate`
  - Add global options: `--json`, `--quiet`
  - Add help text and version command
  - Ensure `npx` compatibility with `-y` flag

  **Must NOT do**:
  - NO command implementations (separate tasks)
  - NO network-dependent features in this task

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (commander setup)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 11-14
  - **Blocked By**: Task 1

  **References**:
  - Library: `commander` v11.0.0
  - External: https://github.com/tj/commander.js

  **Acceptance Criteria**:
  - [ ] `npx xno --version` outputs version
  - [ ] `npx xno --help` shows command list
  - [ ] `npx xno wallet --help` shows subcommands
  - [ ] `npx xno convert --help` shows conversion options
  - [ ] JSON output format works

  **QA Scenarios**:

  Scenario: CLI help text
    Tool: Bash
    Preconditions: Package built
    Steps:
      1. `npx xno --help`
      2. Assert output includes 'wallet', 'convert', 'qr', 'validate'
      3. `npx xno wallet --help`
      4. Assert output includes 'create', 'from-mnemonic'
    Expected Result: Help text displays correctly
    Failure Indicators: Missing commands, exception
    Evidence: .sisyphus/evidence/task-10-cli-help.txt

  **Commit**: YES
  - Message: `feat: set up CLI framework`
  - Files: src/cli.ts, bin/xno
  - Pre-commit: `npm run build`

---

- [ ] 11. CLI: Wallet Create Command

  **What to do**:
  - Implement `xno wallet create` command
  - Options: `--seed`, `--mnemonic`, `--index`, `--json`
  - Output hex seed (64 chars) or mnemonic (24 words)
  - Derive first address (index 0)
  - Display address and QR code
  - NEVER output private key unless explicitly requested

  **Must NOT do**:
  - NO private key output without `--show-private` flag
  - NO seed logging in non-JSON mode
  - NO network calls

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (CLI + existing functions)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 4, 5, 6, 8, 10)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 16
  - **Blocked By**: Task 4, Task 5, Task 6, Task 8, Task 10

  **References**:
  - Uses: generateSeed, seedToMnemonic, deriveAddressLegacy, deriveAddressBIP44

  **Acceptance Criteria**:
  - [ ] `npx xno wallet create --seed` outputs hex seed
  - [ ] `npx xno wallet create --mnemonic` outputs 24-word phrase
  - [ ] `npx xno wallet create --json` outputs valid JSON
  - [ ] Address displayed with QR code
  - [ ] Index option works for address derivation

  **QA Scenarios**:

  Scenario: Seed generation output
    Tool: Bash
    Preconditions: CLI and core functions implemented
    Steps:
      1. `npx xno wallet create --seed --json`
      2. Parse JSON output
      3. Assert `seed` is 64-char hex
      4. Assert `address` starts with `nano_`
      5. Assert `mnemonic` is absent (seed mode)
    Expected Result: JSON with valid seed and address
    Failure Indicators: Invalid hex, missing address
    Evidence: .sisyphus/evidence/task-11-seed-output.json

  Scenario: Mnemonic generation output
    Tool: Bash
    Preconditions: CLI implemented
    Steps:
      1. `npx xno wallet create --mnemonic --json`
      2. Parse JSON
      3. Assert `mnemonic` has 24 space-separated words
      4. Assert `address` is valid Nano address
    Expected Result: JSON with valid mnemonic
    Failure Indicators: Wrong word count, invalid JSON
    Evidence: .sisyphus/evidence/task-11-mnemonic-output.json

  **Commit**: YES
  - Message: `feat: implement wallet create CLI command`
  - Files: src/cli.ts
  - Pre-commit: `npm test`

---

- [ ] 12. CLI: Convert Command

  **What to do**:
  - Implement `xno convert <amount> <from> <to>` command
  - Supported units: `raw`, `XNO`, `nano` (alias for XNO), `knano`, `mnano`
  - Example: `xno convert 1.5 XNO --to raw`
  - Output: precise string (no scientific notation)
  - JSON mode: `{ "input": "1.5", "from": "XNO", "output": "..." }`

  **Must NOT do**:
  - NO scientific notation output
  - NO rounding without `--round` flag
  - NO JavaScript Number conversion

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (CLI + existing convert functions)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 7, 10)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 17
  - **Blocked By**: Task 7, Task 10

  **References**:
  - Uses: nanoToRaw, rawToNano, formatNano from Task 7

  **Acceptance Criteria**:
  - [ ] `npx xno convert 1 XNO --to raw` outputs exact raw amount
  - [ ] `npx xno convert 1.5 XNO --to raw` preserves precision
  - [ ] `npx xno convert 1000000000000000000000000000000 raw --to XNO` outputs `1`
  - [ ] JSON mode works correctly

  **QA Scenarios**:

  Scenario: Conversion accuracy
    Tool: Bash
    Preconditions: CLI and convert functions implemented
    Steps:
      1. `npx xno convert 1 XNO --to raw`
      2. Assert output is exactly `1000000000000000000000000000000`
      3. `npx xno convert 1000000000000000000000000000000 raw --to XNO`
      4. Assert output is exactly `1`
    Expected Result: Perfect conversion without precision loss
    Failure Indicators: Wrong value, scientific notation
    Evidence: .sisyphus/evidence/task-12-convert.txt

  **Commit**: YES
  - Message: `feat: implement convert CLI command`
  - Files: src/cli.ts
  - Pre-commit: `npm test`

---

- [ ] 13. CLI: QR Command

  **What to do**:
  - Implement `xno qr <address> --amount <amount>` command
  - Output ASCII QR to terminal
  - Validate address before generating QR
  - Support amount parameter for payment QRs

  **Must NOT do**:
  - NO PNG/image output
  - NO invalid address QR generation

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (CLI + existing QR)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 9, 10)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 18
  - **Blocked By**: Task 9, Task 10

  **References**:
  - Uses: generateAsciiQr, validateAddress

  **Acceptance Criteria**:
  - [ ] `npx xno qr nano_1...` outputs ASCII QR
  - [ ] `npx xno qr nano_1... --amount 1.5` includes amount in URI
  - [ ] Invalid address shows error message
  - [ ] QR is monospaced and scannable

  **QA Scenarios**:

  Scenario: QR generation from CLI
    Tool: Bash
    Preconditions: CLI and QR implemented
    Steps:
      1. `npx xno qr nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs`
      2. Capture output
      3. Verify output contains `██` blocks
      4. Verify output is non-empty
      5. (Manual) Scan with Nano wallet app
    Expected Result: Scannable QR code
    Failure Indicators: Empty output, exception
    Evidence: .sisyphus/evidence/task-13-qr-cli.txt

  **Commit**: YES
  - Message: `feat: implement qr CLI command`
  - Files: src/cli.ts
  - Pre-commit: `npm test`

---

- [ ] 14. ESM + CJS Build Configuration

  **What to do**:
  - Configure dual build output for ESM and CommonJS
  - ESM: `dist/index.mjs` + type declarations
  - CJS: `dist/index.cjs` + source maps
  - Update package.json exports field for both formats
  - Add build scripts: `npm run build`, `npm run build:esm`, `npm run build:cjs`
  - Ensure CLI works with both formats

  **Must NOT do**:
  - NO bundled dependencies (keep runtime deps separate)
  - NO breaking changes to exports

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (build configuration)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 1-13)
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 15-21
  - **Blocked By**: Task 1-13

  **References**:
  - Pattern: Dual exports in package.json
  - Tools: TypeScript compiler, maybe esbuild for speed

  **Acceptance Criteria**:
  - [ ] `npm run build` produces ESM + CJS outputs
  - [ ] ESM import works: `import { generateSeed } from 'xno'`
  - [ ] CJS import works: `const { generateSeed } = require('xno')`
  - [ ] Type declarations generated
  - [ ] CLI works after build

  **QA Scenarios**:

  Scenario: Dual format import
    Tool: Bash
    Preconditions: Build complete
    Steps:
      1. Create test file `test-esm.mjs`: `import { generateSeed } from './dist/index.mjs'; console.log(generateSeed().length)`
      2. `node test-esm.mjs` → outputs `64`
      3. Create test file `test-cjs.cjs`: `const { generateSeed } = require('./dist/index.cjs'); console.log(generateSeed().length)`
      4. `node test-cjs.cjs` → outputs `64`
    Expected Result: Both formats work
    Failure Indicators: Import errors, undefined functions
    Evidence: .sisyphus/evidence/task-14-build.txt

  **Commit**: YES
  - Message: `feat: configure ESM and CJS dual builds`
  - Files: tsconfig.json, package.json, build scripts
  - Pre-commit: `npm run build && npm test`

---

- [ ] 15. Skills Repo Structure

  **What to do**:
  - Create `xno-skills` repository structure
  - Add subdirectories: `create-wallet/`, `convert-units/`, `validate-address/`
  - Each subdirectory contains `SKILL.md` with YAML frontmatter
  - Add `README.md` explaining installation: `npx skills add casualsecurity/xno-skills`
  - Add template for each skill with trigger keywords

  **Must NOT do**:
  - NO skill implementation content (separate tasks)
  - NO npm publish in this task

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (repo scaffolding)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 14)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 16-18
  - **Blocked By**: Task 14

  **References**:
  - Pattern: https://github.com/anthropics/skills
  - Format: YAML frontmatter with name, description, triggers

  **Acceptance Criteria**:
  - [ ] Repository structure matches skills.sh format
  - [ ] Each subdirectory has `SKILL.md` file
  - [ ] YAML frontmatter includes name and description
  - [ ] README explains installation via `npx skills add`

  **QA Scenarios**:

  Scenario: Skills repo structure
    Tool: Bash
    Preconditions: Repo created
    Steps:
      1. `ls -la xno-skills/` → directories exist
      2. `cat xno-skills/create-wallet/SKILL.md` → YAML frontmatter present
      3. Check all skill directories have SKILL.md
    Expected Result: Proper structure
    Failure Indicators: Missing files, wrong structure
    Evidence: .sisyphus/evidence/task-15-structure.txt

  **Commit**: YES
  - Message: `feat: create xno-skills repository structure`
  - Files: xno-skills/* (new repo)
  - Pre-commit: none

---

- [ ] 16. Skill: create-wallet

  **What to do**:
  - Implement `create-wallet/SKILL.md` skill
  - YAML frontmatter: name, description, triggers (`nano`, `wallet`, `xno`, `cryptocurrency`)
  - Markdown content: step-by-step wallet creation workflow
  - Include CLI command examples: `npx -y xno wallet create --mnemonic`
  - Include security notes: never share seeds, use env vars for storage
  - Include code example for programmatic use

  **Must NOT do**:
  - NO actual wallet creation in skill (agent uses CLI)
  - NO hardcoded seeds in examples

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]` (documentation focused)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 6, 11, 15)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task F4
  - **Blocked By**: Task 6, Task 11, Task 15

  **References**:
  - Template: https://github.com/anthropics/skills/blob/main/template/SKILL.md
  - CLI commands from Task 11

  **Acceptance Criteria**:
  - [ ] SKILL.md has valid YAML frontmatter
  - [ ] Includes CLI command examples
  - [ ] Includes security warnings
  - [ ] Includes programmatic code example
  - [ ] Trigger keywords include `nano`, `wallet`, `xno`

  **QA Scenarios**:

  Scenario: Skill installation
    Tool: Bash
    Preconditions: Skill implemented
    Steps:
      1. `npx skills add casualsecurity/xno-skills -y --all`
      2. Verify skill appears in agent's skill list
      3. Trigger skill with "create a nano wallet"
      4. Verify skill content guides to CLI usage
    Expected Result: Skill installs and activates
    Failure Indicators: Skill not found, wrong content
    Evidence: .sisyphus/evidence/task-16-skill-install.txt

  **Commit**: YES
  - Message: `feat: add create-wallet skill`
  - Files: xno-skills/create-wallet/SKILL.md
  - Pre-commit: none

---

- [ ] 17. Skill: convert-units

  **What to do**:
  - Implement `convert-units/SKILL.md` skill
  - YAML frontmatter with appropriate triggers
  - Explain raw, XNO, knano, mnano units
  - Include CLI examples for conversions
  - Include precision notes (30 decimal places, BigInt)
  - Show common conversion examples

  **Must NOT do**:
  - NO conversion implementation in skill (agent uses CLI)
  - NO floating-point examples

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]` (documentation focused)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 7, 12, 15)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task F4
  - **Blocked By**: Task 7, Task 12, Task 15

  **Acceptance Criteria**:
  - [ ] SKILL.md explains all unit types
  - [ ] Includes conversion CLI examples
  - [ ] Mentions precision handling
  - [ ] Shows common use cases

  **QA Scenarios**:

  Scenario: Skill content accuracy
    Tool: Read
    Preconditions: Skill file created
    Steps:
      1. Read SKILL.md content
      2. Verify mentions `raw`, `XNO`, `knano`, `mnano`
      3. Verify includes CLI command
      4. Verify mentions BigInt/precision
    Expected Result: Accurate documentation
    Failure Indicators: Missing units, wrong info
    Evidence: .sisyphus/evidence/task-17-skill-content.txt

  **Commit**: YES
  - Message: `feat: add convert-units skill`
  - Files: xno-skills/convert-units/SKILL.md
  - Pre-commit: none

---

- [ ] 18. Skill: validate-address

  **What to do**:
  - Implement `validate-address/SKILL.md` skill
  - Explain Nano address format (nano_ prefix, 60 chars)
  - Include CLI validation command
  - Explain checksum verification process
  - Show examples of valid and invalid addresses

  **Must NOT do**:
  - NO validation implementation in skill
  - NO network validation mention (offline only)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]` (documentation focused)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 6, 13, 15)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task F4
  - **Blocked By**: Task 6, Task 13, Task 15

  **Acceptance Criteria**:
  - [ ] Explains address format
  - [ ] Shows validation CLI
  - [ ] Shows valid vs invalid examples
  - [] Mention checksum verification

  **QA Scenarios**:

  Scenario: Skill validation guidance
    Tool: Read
    Preconditions: Skill implemented
    Steps:
      1. Read SKILL.md
      2. Verify shows `nano_1anrz...` as valid example
      3. Verify shows invalid checksum example
      4. Verify explains nano_ prefix
    Expected Result: Complete validation guide
    Failure Indicators: Missing format info
    Evidence: .sisyphus/evidence/task-18-skill-validation.txt

  **Commit**: YES
  - Message: `feat: add validate-address skill`
  - Files: xno-skills/validate-address/SKILL.md
  - Pre-commit: none

---

- [ ] 19. Package Exports + README

  **What to do**:
  - Finalize package.json exports for all public functions
  - Ensure TypeScript types are exported correctly
  - Write comprehensive README.md
  - Include: Installation, Quick Start, CLI Usage, API Reference, Security Notes
  - Add badges: npm version, license, test coverage
  - Document all exported functions with examples

  **Must NOT do**:
  - NO internal functions in exports
  - NO incomplete API documentation

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `[]` (documentation)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 14)
  - **Parallel Group**: Wave 3
  - **Blocks**: —
  - **Blocked By**: Task 14

  **References**:
  - Pattern: Clear API docs with examples
  - Security: Add section on seed handling

  **Acceptance Criteria**:
  - [ ] README includes installation instructions
  - [ ] README includes CLI examples
  - [ ] README includes API usage examples
  - [ ] README includes security warnings
  - [ ] All public functions documented
  - [ ] Badges added

  **QA Scenarios**:

  Scenario: README completeness
    Tool: Read
    Preconditions: README written
    Steps:
      1. Check for "Installation" section
      2. Check for "Quick Start" section
      3. Check for "API Reference" section
      4. Check for "Security" section
      5. Check for CLI examples
    Expected Result: Complete documentation
    Failure Indicators: Missing sections
    Evidence: .sisyphus/evidence/task-19-readme.txt

  **Commit**: YES
  - Message: `docs: add comprehensive README and package exports`
  - Files: README.md, package.json (exports field)
  - Pre-commit: none

---

- [ ] 20. Test Vectors Validation

  **What to do**:
  - Add comprehensive test file using official Nano test vectors
  - Test seed generation entropy (uniqueness)
  - Test address derivation against known vectors
  - Test unit conversions edge cases (0, 1 raw, max)
  - Test BIP39 mnemonic roundtrips
  - Test BIP44 derivation compatibility
  - Ensure 100% coverage of core functions

  **Must NOT do**:
  - NO custom test vectors (use official Nano vectors)
  - NO skipped test cases

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]` (testing)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 1-20)
  - **Parallel Group**: Wave 3
  - **Blocks**: —
  - **Blocked By**: Tasks 1-20

  **References**:
  - External: https://docs.nano.org/integration-guides/the-basics/#example-vectors
  - External: https://github.com/nanocurrency/nano-tests

  **Acceptance Criteria**:
  - [ ] All official Nano test vectors pass
  - [ ] Seed entropy tests pass (100 unique seeds)
  - [ ] Address derivation matches reference implementations
  - [ ] Unit conversion edge cases handled
  - [ ] BIP39 roundtrips verified
  - [ ] 100% test coverage (core functions)

  **QA Scenarios**:

  Scenario: Official test vectors pass
    Tool: vitest
    Preconditions: Core functions implemented
    Steps:
      1. Import official test vectors
      2. Run: `npm test`
      3. Assert all tests pass
      4. Check coverage: `npm run coverage`
    Expected Result: All tests pass, 100% coverage
    Failure Indicators: Failed tests, low coverage
    Evidence: .sisyphus/evidence/task-20-coverage.txt

  **Commit**: YES
  - Message: `test: add comprehensive test vectors`
  - Files: test/vectors.test.ts
  - Pre-commit: `npm test`

---

- [ ] 21. Security Audit + SECURITY.md

  **What to do**:
  - Create SECURITY.md with responsible disclosure policy
  - Audit code for seed/mnemonic logging
  - Ensure timing-safe comparisons where needed
  - Add memory cleanup for sensitive data (`buffer.fill(0)`)
  - Add `.npmignore` to exclude test files from package
  - Document entropy source requirements
  - Add security warnings in README

  **Must NOT do**:
  - NO actual code changes that break functionality
  - NO seed logging in any error path

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: `[]` (security review)

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Tasks 1-20)
  - **Parallel Group**: Wave 3
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 1-20

  **References**:
  - Security best practices for crypto wallets
  - Responsible disclosure: security@example.com

  **Acceptance Criteria**:
  - [ ] SECURITY.md exists with disclosure policy
  - [ ] Grep for seed in logs returns empty
  - [ ] Timing-safe comparisons used
  - [ ] `.npmignore` excludes test files
  - [ ] README has security warnings

  **QA Scenarios**:

  Scenario: No seed logging
    Tool: Bash
    Preconditions: Code complete
    Steps:
      1. `grep -r "console.log.*seed" src/` → empty
      2. `grep -r "console.log.*mnemonic" src/` → empty
      3. `grep -r "console.error.*seed" src/` → empty
    Expected Result: No matches found
    Failure Indicators: Any matches
    Evidence: .sisyphus/evidence/task-21-no-seed-logs.txt

  **Commit**: YES
  - Message: `security: add SECURITY.md and audit code`
  - Files: SECURITY.md, .npmignore, src/*.ts (cleanup)
  - Pre-commit: `npm test`

---

## Final Verification Wave (MANDATORY)

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, check exports). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check all test tasks reference .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in production, commented-out code, unused imports. Check for crypto best practices: timing-safe comparisons, buffer cleanup, entropy sources.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **CLI Functional QA** — `unspecified-high`
  Run: `npx xno wallet create --json` → valid JSON. `npx xno convert 1 XNO --to raw` → exact value. `npx xno qr nano_1...` → ASCII QR output. Test error cases: invalid address, malformed input.
  Output: `Commands [N/N pass] | Error Handling [N/N] | VERDICT`

- [ ] F4. **Skills Integration Test** — `unspecified-high`
  Clone xno-skills repo. Run `npx skills add ./xno-skills -y`. Verify all skills visible in agent. Test each skill with trigger phrase. Check SKILL.md frontmatter validity.
  Output: `Skills [N/N installed] | Triggers [N/N work] | VERDICT`

---

## Commit Strategy

- **1**: `feat: initialize xno package scaffolding` — scaffold commit
- **2-21**: Individual feature commits as listed in each task
- **Final**: `chore: prepare v0.1.0 release` — version bump, CI setup

---

## Success Criteria

### Verification Commands
```bash
npm install                    # Install dependencies
npm run build                  # Build ESM + CJS
npm test                       # Run all tests
npx xno wallet create --json   # CLI test
npx xno convert 1 XNO --to raw # Conversion test
npx xno qr nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs # QR test
```

### Final Checklist
- [ ] All "Must Have" features present
- [ ] All "Must NOT Have" features absent
- [ ] All test vectors pass
- [ ] No seeds/mnemonics in logs
- [ ] BigInt precision validated (1e-30 preservation)
- [ ] CLI works via npx
- [ ] Skills installable
- [ ] TypeScript types exported
- [ ] MIT LICENSE present
- [ ] README complete with examples