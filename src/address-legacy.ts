// Legacy Nano address derivation using Blake2b-based path
// Path: PrivK[i] = blake2b(seed || i, 32) where i is 32-bit big-endian uint
// Public key: Ed25519 from private key (using Blake2b-512 for key derivation)
// Address: Apply nano-base32 encoding with checksum

import { blake2b } from '@noble/hashes/blake2b.js';
import { ed25519 } from '@noble/curves/ed25519.js';

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string: length must be even');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function derivePrivateKeyLegacy(seed: string, index: number): string {
  if (seed.length !== 64) {
    throw new Error('Seed must be 64 hex characters (32 bytes)');
  }
  if (!/^[0-9a-fA-F]+$/.test(seed)) {
    throw new Error('Seed must be a valid hex string');
  }
  if (!Number.isInteger(index) || index < 0 || index > 0xFFFFFFFF) {
    throw new Error('Index must be a valid 32-bit unsigned integer');
  }

  const seedBytes = hexToBytes(seed);
  
  const indexBytes = new Uint8Array(4);
  indexBytes[0] = (index >>> 24) & 0xff;
  indexBytes[1] = (index >>> 16) & 0xff;
  indexBytes[2] = (index >>> 8) & 0xff;
  indexBytes[3] = index & 0xff;
  
  const data = new Uint8Array(seedBytes.length + indexBytes.length);
  data.set(seedBytes, 0);
  data.set(indexBytes, seedBytes.length);
  
  const privateKey = blake2b(data, { dkLen: 32 });
  
  return bytesToHex(privateKey);
}

export function derivePublicKeyLegacy(privateKey: string): string {
  if (privateKey.length !== 64) {
    throw new Error('Private key must be 64 hex characters (32 bytes)');
  }
  if (!/^[0-9a-fA-F]+$/.test(privateKey)) {
    throw new Error('Private key must be a valid hex string');
  }

  const privateKeyBytes = hexToBytes(privateKey);
  
  // Nano uses Blake2b-512 for Ed25519 key derivation instead of SHA-512
  const hash = blake2b(privateKeyBytes, { dkLen: 64 });
  
  // Clamp the first 32 bytes (scalar) per RFC 8032
  const scalarBytes = new Uint8Array(hash.slice(0, 32));
  scalarBytes[0] &= 248;
  scalarBytes[31] &= 127;
  scalarBytes[31] |= 64;
  
  // Convert to bigint (little-endian)
  let scalarBigint = 0n;
  for (let i = 0; i < 32; i++) {
    scalarBigint += BigInt(scalarBytes[i]) << BigInt(8 * i);
  }
  
  // Ed25519 curve order
  const CURVE_ORDER = BigInt('0x1000000000000000000000000000000014def9dea2f79cd65812631a5cf5d3ed');
  
  // Ensure scalar is in valid range
  if (scalarBigint === 0n || scalarBigint >= CURVE_ORDER) {
    scalarBigint = scalarBigint % CURVE_ORDER;
    if (scalarBigint === 0n) {
      scalarBigint = 1n;
    }
  }
  
  const publicKeyPoint = ed25519.Point.BASE.multiply(scalarBigint);
  
  return bytesToHex(publicKeyPoint.toBytes());
}

export function publicKeyToAddress(publicKey: string): string {
  if (publicKey.length !== 64) {
    throw new Error('Public key must be 64 hex characters (32 bytes)');
  }
  if (!/^[0-9a-fA-F]+$/.test(publicKey)) {
    throw new Error('Public key must be a valid hex string');
  }

  const publicKeyBytes = hexToBytes(publicKey);
  
  const checksum = blake2b(publicKeyBytes, { dkLen: 5 });
  
  const combined = new Uint8Array(checksum.length + publicKeyBytes.length);
  combined.set(checksum, 0);
  combined.set(publicKeyBytes, checksum.length);
  
  const encoded = encodeNanoAddress(combined);
  
  return `nano_${encoded}`;
}

function encodeNanoAddress(data: Uint8Array): string {
  const CHARSET = '13456789abcdefghijkmnopqrstuwxyz';
  
  let result = '';
  let buffer = 0;
  let bits = 0;
  
  for (let i = data.length - 1; i >= 0; i--) {
    buffer = (buffer << 8) | data[i];
    bits += 8;
    
    while (bits >= 5) {
      bits -= 5;
      const index = (buffer >> bits) & 0x1f;
      result += CHARSET[index];
    }
  }
  
  if (bits > 0) {
    const index = (buffer << (5 - bits)) & 0x1f;
    result += CHARSET[index];
  }
  
  return result;
}

export interface LegacyAddressResult {
  privateKey: string;
  publicKey: string;
  address: string;
}

export function deriveAddressLegacy(seed: string, index: number): LegacyAddressResult {
  const privateKey = derivePrivateKeyLegacy(seed, index);
  const publicKey = derivePublicKeyLegacy(privateKey);
  const address = publicKeyToAddress(publicKey);
  
  return {
    privateKey,
    publicKey,
    address,
  };
}