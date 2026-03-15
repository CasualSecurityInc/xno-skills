// Cryptographically secure seed generation with BIP39 mnemonic support
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

function wordCountToStrength(wordCount: number): number {
  // BIP39: 12/15/18/21/24 words correspond to 128/160/192/224/256 bits entropy.
  switch (wordCount) {
    case 12: return 128;
    case 15: return 160;
    case 18: return 192;
    case 21: return 224;
    case 24: return 256;
    default:
      throw new Error('Word count must be one of: 12, 15, 18, 21, 24');
  }
}

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
 * Generate a BIP39 mnemonic phrase (default: 24 words).
 *
 * Note: This returns the mnemonic sentence only. How that mnemonic is used to
 * derive Nano accounts depends on the derivation scheme (BIP39 HD vs legacy).
 */
export function generateMnemonic(wordCount: number = 24): string {
  const strength = wordCountToStrength(wordCount);
  return bip39.generateMnemonic(wordlist, strength);
}

/**
 * Convert a hex-encoded seed to a BIP39 mnemonic phrase
 * Supports any valid BIP39 entropy length (128-256 bits, in 32-bit increments)
 * @param seed - Hex-encoded seed string (32 or 64 hex characters)
 * @returns BIP39 mnemonic phrase (12 or 24 words)
 */
export function seedToMnemonic(seed: string): string {
  const entropy = hexToBytes(seed);
  return bip39.entropyToMnemonic(entropy, wordlist);
}

/**
 * Convert a BIP39 mnemonic phrase back to its underlying entropy (hex).
 *
 * This is *not* the BIP39 PBKDF2 “seed”; it is the raw entropy that the mnemonic encodes.
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
