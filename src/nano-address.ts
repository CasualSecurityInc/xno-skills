import { blake2b } from '@noble/hashes/blake2b.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

const CHARSET = '13456789abcdefghijkmnopqrstuwxyz';
const CHAR_TO_VALUE: Record<string, number> = Object.fromEntries(
  [...CHARSET].map((c, i) => [c, i])
);

export type NanoAddressPrefix = 'nano_' | 'xrb_';

export interface DecodeNanoAddressResult {
  prefix: NanoAddressPrefix;
  publicKey: string; // hex (64 chars)
}

function toBitsMsbFirst(bytes: Uint8Array): number[] {
  const bits: number[] = new Array(bytes.length * 8);
  let k = 0;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    for (let j = 7; j >= 0; j--) {
      bits[k++] = (b >> j) & 1;
    }
  }
  return bits;
}

function bitsToBytesMsbFirst(bits: number[]): Uint8Array {
  if (bits.length % 8 !== 0) throw new Error('Bit length must be a multiple of 8');
  const out = new Uint8Array(bits.length / 8);
  for (let i = 0; i < out.length; i++) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | (bits[i * 8 + j] & 1);
    }
    out[i] = b;
  }
  return out;
}

function reverseBytes(bytes: Uint8Array): Uint8Array {
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[bytes.length - 1 - i];
  return out;
}

export function publicKeyToNanoAddress(publicKeyHex: string, prefix: NanoAddressPrefix = 'nano_'): string {
  if (publicKeyHex.length !== 64) throw new Error('Public key must be 64 hex characters (32 bytes)');
  if (!/^[0-9a-fA-F]+$/.test(publicKeyHex)) throw new Error('Public key must be a valid hex string');

  const publicKeyBytes = hexToBytes(publicKeyHex);

  const checksum = blake2b(publicKeyBytes, { dkLen: 5 });
  const checksumReversed = reverseBytes(checksum);

  const combined = new Uint8Array(32 + 5);
  combined.set(publicKeyBytes, 0);
  combined.set(checksumReversed, 32);

  // Nano encodes 37 bytes (296 bits) into 60 base32 chars (300 bits) by prepending 4 zero bits.
  const combinedBits = toBitsMsbFirst(combined); // 296 bits
  const bits300 = [0, 0, 0, 0, ...combinedBits]; // 300 bits

  let encoded = '';
  for (let i = 0; i < 60; i++) {
    let v = 0;
    for (let j = 0; j < 5; j++) {
      v = (v << 1) | bits300[i * 5 + j];
    }
    encoded += CHARSET[v];
  }

  return `${prefix}${encoded}`;
}

export function decodeNanoAddress(address: string): DecodeNanoAddressResult {
  const prefix: NanoAddressPrefix | null =
    address.startsWith('nano_') ? 'nano_' :
    address.startsWith('xrb_') ? 'xrb_' :
    null;

  if (!prefix) {
    throw new Error("Invalid prefix. Address must start with 'nano_' or 'xrb_'.");
  }

  const payload = address.slice(prefix.length);
  if (payload.length !== 60) {
    throw new Error(`Invalid length. Address must be ${prefix === 'nano_' ? 65 : 64} characters, got ${address.length}.`);
  }

  const bits300: number[] = new Array(300);
  for (let i = 0; i < 60; i++) {
    const c = payload[i];
    const v = CHAR_TO_VALUE[c];
    if (v === undefined) {
      throw new Error(`Invalid Base32 character '${c}' at position ${i}.`);
    }
    // 5 bits, msb-first
    bits300[i * 5 + 0] = (v >> 4) & 1;
    bits300[i * 5 + 1] = (v >> 3) & 1;
    bits300[i * 5 + 2] = (v >> 2) & 1;
    bits300[i * 5 + 3] = (v >> 1) & 1;
    bits300[i * 5 + 4] = v & 1;
  }

  // First 4 bits must be zero in canonical encoding; keep this as a check.
  if (bits300[0] !== 0 || bits300[1] !== 0 || bits300[2] !== 0 || bits300[3] !== 0) {
    throw new Error('Invalid address padding bits.');
  }

  const combinedBits = bits300.slice(4); // 296 bits
  const combined = bitsToBytesMsbFirst(combinedBits); // 37 bytes

  const publicKeyBytes = combined.slice(0, 32);
  const checksumReversed = combined.slice(32, 37);
  const checksum = reverseBytes(checksumReversed);
  const expected = blake2b(publicKeyBytes, { dkLen: 5 });

  for (let i = 0; i < 5; i++) {
    if (checksum[i] !== expected[i]) throw new Error('Invalid checksum. Address verification failed.');
  }

  return { prefix, publicKey: bytesToHex(publicKeyBytes) };
}

