// Cryptographically secure seed generation with BIP39 mnemonic support
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

/**
 * Generate a cryptographically secure 32-byte seed (256 bits)
 * Uses crypto.getRandomValues for browser and Node.js compatibility
 * @returns 64-character hex string representing 32 bytes of entropy
 */
export function generateSeed(): string {
  const entropy = new Uint8Array(32);
  // Use globalThis.crypto which works in both browser and Node.js (18+)
  (globalThis as unknown as { crypto: { getRandomValues: (arr: Uint8Array) => Uint8Array } }).crypto.getRandomValues(entropy);
  return bytesToHex(entropy);
}

/**
 * Convert a hex-encoded seed to a BIP39 mnemonic phrase
 * Supports both 128-bit (32-char hex = 12 words) and 256-bit (64-char hex = 24 words) seeds
 * @param seed - Hex-encoded seed string (32 or 64 hex characters)
 * @returns BIP39 mnemonic phrase (12 or 24 words)
 */
export function seedToMnemonic(seed: string): string {
  const entropy = hexToBytes(seed);
  return bip39.entropyToMnemonic(entropy, wordlist);
}

/**
 * Convert a BIP39 mnemonic phrase back to a hex-encoded seed
 * @param mnemonic - BIP39 mnemonic phrase (12 or 24 words)
 * @returns Hex-encoded seed string
 */
export function mnemonicToSeed(mnemonic: string): string {
  const entropy = bip39.mnemonicToEntropy(mnemonic, wordlist);
  return bytesToHex(entropy);
}

/**
 * Validate a BIP39 mnemonic phrase
 * @param mnemonic - Mnemonic phrase to validate
 * @returns true if valid, false otherwise
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic, wordlist);
}

/**
 * Convert Uint8Array to hex string
 * @param bytes - Byte array
 * @returns Hex-encoded string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
 * @param hex - Hex-encoded string
 * @returns Byte array
 */
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