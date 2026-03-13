// Blake2b hash functions using @noble/hashes
import { blake2b } from '@noble/hashes/blake2b.js';
import { bytesToHex } from '@noble/hashes/utils.js';

/**
 * Compute BLAKE2b-256 hash (32 bytes / 256 bits)
 * @param data - Input data as Uint8Array
 * @returns 32-byte hash
 */
export function blake2b256(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 32 });
}

/**
 * Compute BLAKE2b-512 hash (64 bytes / 512 bits)
 * @param data - Input data as Uint8Array
 * @returns 64-byte hash
 */
export function blake2b512(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 64 });
}

/**
 * Compute BLAKE2b-256 hash and return as hex string
 * @param data - Input data as Uint8Array
 * @returns Hex-encoded 32-byte hash (64 hex characters)
 */
export function blake2b256Hex(data: Uint8Array): string {
  return bytesToHex(blake2b256(data));
}
