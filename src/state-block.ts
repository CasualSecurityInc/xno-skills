import { blake2b } from '@noble/hashes/blake2b.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

export type Hex64 = string; // 32 bytes hex

export interface StateBlockHashInput {
  accountPublicKey: Hex64;
  previous: Hex64;
  representativePublicKey: Hex64;
  balanceRaw: string; // decimal string
  link: Hex64;
}

const STATE_BLOCK_PREAMBLE = (() => {
  const p = new Uint8Array(32);
  p[31] = 0x06;
  return p;
})();

function assertHex32Bytes(hex: string, label: string): void {
  if (typeof hex !== 'string' || hex.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`${label} must be 32-byte hex (64 hex characters)`);
  }
}

function encodeUint128BE(decimal: string): Uint8Array {
  if (typeof decimal !== 'string' || !/^\d+$/.test(decimal)) {
    throw new Error('balanceRaw must be an unsigned decimal string');
  }
  const n = BigInt(decimal);
  if (n < 0n) throw new Error('balanceRaw must be non-negative');
  const max = (1n << 128n) - 1n;
  if (n > max) throw new Error('balanceRaw exceeds 128-bit unsigned integer');

  const out = new Uint8Array(16);
  let x = n;
  for (let i = 15; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

export function hashNanoStateBlock(input: StateBlockHashInput): Uint8Array {
  assertHex32Bytes(input.accountPublicKey, 'accountPublicKey');
  assertHex32Bytes(input.previous, 'previous');
  assertHex32Bytes(input.representativePublicKey, 'representativePublicKey');
  assertHex32Bytes(input.link, 'link');

  const account = hexToBytes(input.accountPublicKey);
  const previous = hexToBytes(input.previous);
  const representative = hexToBytes(input.representativePublicKey);
  const balance = encodeUint128BE(input.balanceRaw);
  const link = hexToBytes(input.link);

  const preimage = new Uint8Array(32 + 32 + 32 + 32 + 16 + 32);
  let o = 0;
  preimage.set(STATE_BLOCK_PREAMBLE, o); o += 32;
  preimage.set(account, o); o += 32;
  preimage.set(previous, o); o += 32;
  preimage.set(representative, o); o += 32;
  preimage.set(balance, o); o += 16;
  preimage.set(link, o); o += 32;

  return blake2b(preimage, { dkLen: 32 });
}

export function hashNanoStateBlockHex(input: StateBlockHashInput): string {
  return bytesToHex(hashNanoStateBlock(input));
}

/**
 * Build the 176-byte canonical state block (preamble + fields) and return it as hex.
 * This is the unsigned block that OWS expects for `ows sign tx --chain nano`.
 */
export function buildNanoStateBlockHex(input: StateBlockHashInput): string {
  assertHex32Bytes(input.accountPublicKey, 'accountPublicKey');
  assertHex32Bytes(input.previous, 'previous');
  assertHex32Bytes(input.representativePublicKey, 'representativePublicKey');
  assertHex32Bytes(input.link, 'link');

  const account = hexToBytes(input.accountPublicKey);
  const previous = hexToBytes(input.previous);
  const representative = hexToBytes(input.representativePublicKey);
  const balance = encodeUint128BE(input.balanceRaw);
  const link = hexToBytes(input.link);

  const block = new Uint8Array(176);
  let o = 0;
  block.set(STATE_BLOCK_PREAMBLE, o); o += 32;
  block.set(account, o); o += 32;
  block.set(previous, o); o += 32;
  block.set(representative, o); o += 32;
  block.set(balance, o); o += 16;
  block.set(link, o);

  return bytesToHex(block);
}

/**
 * Parse a 176-byte state block hex back into its constituent fields.
 * Layout: [32 preamble][32 accountPublicKey][32 previous][32 representativePublicKey][16 balance][32 link]
 */
export function parseNanoStateBlockHex(hex: string): StateBlockHashInput & { balanceRaw: string } {
  if (typeof hex !== 'string' || hex.length !== 352) {
    throw new Error(`State block hex must be 352 hex characters (176 bytes), got ${hex?.length ?? 'undefined'}`);
  }
  const bytes = hexToBytes(hex);
  // skip 32-byte preamble
  const accountPublicKey = bytesToHex(bytes.slice(32, 64));
  const previous = bytesToHex(bytes.slice(64, 96));
  const representativePublicKey = bytesToHex(bytes.slice(96, 128));
  const balanceBytes = bytes.slice(128, 144);
  let balance = 0n;
  for (const b of balanceBytes) balance = (balance << 8n) | BigInt(b);
  const balanceRaw = balance.toString();
  const link = bytesToHex(bytes.slice(144, 176));
  return { accountPublicKey, previous, representativePublicKey, balanceRaw, link };
}

