# xno-skills Library API

This document covers using `xno-skills` as a TypeScript/JavaScript library. For CLI and MCP usage, see the [README](./README.md).

```bash
npm install xno-skills
```

## Address Validation

```typescript
import { validateAddress } from 'xno-skills';

const result = validateAddress('nano_1abc123...');
// { valid: true, publicKey: "..." }
// or { valid: false, error: "Invalid prefix..." }
```

## Unit Conversion

All conversion functions use string-based BigInt math to preserve Nano's full 30-decimal precision.

```typescript
import { nanoToRaw, rawToNano, knanoToRaw, mnanoToRaw } from 'xno-skills';

nanoToRaw('1.5');
// "1500000000000000000000000000000"

rawToNano('1500000000000000000000000000000');
// "1.5"

knanoToRaw('1.5');
// "1500000000000000000000000000000000"

mnanoToRaw('1.5');
// "1500000000000000000000000000000000000"
```

## QR Code Generation

```typescript
import { generateAsciiQr, buildNanoUri } from 'xno-skills';

const qr = await generateAsciiQr('nano_1abc123...');
console.log(qr);

// With amount (number, in XNO)
const qr = await generateAsciiQr('nano_1abc123...', 1.5);

// Build a nano: URI without QR
const uri = buildNanoUri('nano_1abc123...', '1.5');
// "nano:nano_1abc123...?amount=1500000000000000000000000000000"
```

## Address Encoding

```typescript
import { decodeNanoAddress, publicKeyToNanoAddress } from 'xno-skills';

const { publicKey } = decodeNanoAddress('nano_1abc123...');
const address = publicKeyToNanoAddress(publicKey);
```

## RPC Functions

All RPC functions accept a `NanoClient` from `@openrai/nano-core`:

```typescript
import { rpcAccountBalance, rpcAccountInfo, rpcReceivable } from 'xno-skills';
import { NanoClient } from '@openrai/nano-core';

const client = NanoClient.initialize({ rpc: ['https://rainstorm.city/api'] });

const balance = await rpcAccountBalance(client, 'nano_1abc123...');
// { balance: "...", pending: "..." }

const info = await rpcAccountInfo(client, 'nano_1abc123...');
// { frontier, representative, balance, pending, block_count, weight }

const pending = await rpcReceivable(client, 'nano_1abc123...', 10);
// [{ hash, amount, source }, ...]
```

## State Block Hashing

```typescript
import { hashNanoStateBlock } from 'xno-skills';

const hash = hashNanoStateBlock({
  accountPublicKey: '...',
  previous: '...',
  representativePublicKey: '...',
  balanceRaw: '...',
  link: '...',
});
```

## Ed25519-Blake2b Signatures

```typescript
import { nanoSignBlake2b, nanoVerifyBlake2b } from 'xno-skills';

const signature = nanoSignBlake2b(messageHash, privateKey);
const valid = nanoVerifyBlake2b(messageHash, signature, publicKey);
```

## Off-chain Message Signing (NOMS)

```typescript
import { NOMS } from 'xno-skills';

const signature = NOMS.signMessage('Hello, Nano!', privateKeyHex);
const valid = NOMS.verifyMessage('Hello, Nano!', signature, publicKeyHex);
```

## Proof of Work

```typescript
import { localWorkGenerate, validateWork, getThresholdForSubtype } from 'xno-skills';

const threshold = getThresholdForSubtype('send');
const { work } = await localWorkGenerate(blockHash, threshold);
validateWork(work);
```

`getThresholdForSubtype` returns a `WorkDifficulty` — the named level that `@openrai/nano-core` defines. There is no xno-skills-specific difficulty vocabulary; import `WorkDifficulty` from `xno-skills` if you need the level itself rather than a subtype mapping.

```typescript
import { WorkDifficulty, workDifficultyToThreshold } from 'xno-skills';

WorkDifficulty.Send; // 'send'
workDifficultyToThreshold(WorkDifficulty.Send); // 'fffffff800000000'
workDifficultyToThreshold('fffffff800000000'); // same — hex passes through
```

The local engine takes a canonical 16-character hexadecimal threshold, and `nano-core` resolves names to it for you, so `localWorkGenerate` accepts a `WorkDifficulty` directly.
