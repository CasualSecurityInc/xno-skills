// BIP44 derivation for Nano using SLIP-0010 for Ed25519
// Path: m/44'/165'/[address_index]' (coin_type 165 for Nano)
// Uses standard Ed25519 for public key derivation (not Blake2b like legacy)

import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from 'micro-key-producer/slip10.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { blake2b } from '@noble/hashes/blake2b.js';
import { publicKeyToNanoAddress } from './nano-address.js';

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert hex string to Uint8Array
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

/**
 * Derive a private key from a mnemonic using BIP44 path for Nano
 * Path: m/44'/165'/[address_index]' (all hardened derivation)
 * 
 * @param mnemonic - BIP39 mnemonic phrase (12 or 24 words)
 * @param index - Address index (0, 1, 2, ...)
 * @param passphrase - Optional BIP39 passphrase (default: empty string)
 * @returns 64-character hex string representing the 32-byte private key
 */
export function derivePrivateKeyBIP44(
  mnemonic: string,
  index: number,
  passphrase: string = ''
): string {
  // Validate mnemonic
  if (!bip39.validateMnemonic(mnemonic, wordlist)) {
    throw new Error('Invalid mnemonic phrase');
  }
  
  // Validate index
  if (!Number.isInteger(index) || index < 0 || index > 0x7FFFFFFF) {
    throw new Error('Index must be a valid 31-bit unsigned integer (0 to 2147483647)');
  }
  
  // Convert mnemonic to BIP39 seed (512-bit)
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
  
  // Create HD key from seed using SLIP-0010 (Ed25519)
  const masterKey = HDKey.fromMasterSeed(seed);
  
  // Derive path: m/44'/165'/[index]'
  // 44' = BIP44 purpose
  // 165' = Nano coin type (SLIP-0044)
  // index' = address index (hardened)
  const path = `m/44'/165'/${index}'`;
  const derivedKey = masterKey.derive(path);
  
  // Return private key as hex string
  return bytesToHex(derivedKey.privateKey);
}

/**
 * Derive public key from private key using Nano's Blake2b-512 Ed25519 variant
 * Note: Nano uses Blake2b-512 for Ed25519 key derivation, not standard SHA-512
 * 
 * @param privateKey - 64-character hex string (32 bytes)
 * @returns 64-character hex string representing the 32-byte public key
 */
export function derivePublicKeyBIP44(privateKey: string): string {
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

/**
 * Convert public key to Nano address
 * 
 * @param publicKey - 64-character hex string (32 bytes)
 * @returns Nano address starting with 'nano_'
 */
export function publicKeyToAddressBIP44(publicKey: string): string {
  if (publicKey.length !== 64) {
    throw new Error('Public key must be 64 hex characters (32 bytes)');
  }
  if (!/^[0-9a-fA-F]+$/.test(publicKey)) {
    throw new Error('Public key must be a valid hex string');
  }

  return publicKeyToNanoAddress(publicKey, 'nano_');
}

/**
 * Result of BIP44 address derivation
 */
export interface BIP44AddressResult {
  privateKey: string;
  publicKey: string;
  address: string;
}

/**
 * Derive a Nano address from a mnemonic using BIP44 path
 * Path: m/44'/165'/[address_index]' (all hardened derivation)
 * 
 * @param mnemonic - BIP39 mnemonic phrase (12 or 24 words)
 * @param index - Address index (0, 1, 2, ...)
 * @param passphrase - Optional BIP39 passphrase (default: empty string)
 * @returns Object containing privateKey, publicKey, and address
 */
export function deriveAddressBIP44(
  mnemonic: string,
  index: number,
  passphrase: string = ''
): BIP44AddressResult {
  const privateKey = derivePrivateKeyBIP44(mnemonic, index, passphrase);
  const publicKey = derivePublicKeyBIP44(privateKey);
  const address = publicKeyToAddressBIP44(publicKey);
  
  return {
    privateKey,
    publicKey,
    address,
  };
}

/**
 * Validate a BIP39 mnemonic phrase
 * 
 * @param mnemonic - Mnemonic phrase to validate
 * @returns true if valid, false otherwise
 */
export function validateMnemonicBIP44(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic, wordlist);
}

/**
 * Convert mnemonic to BIP39 seed (for debugging/verification)
 * 
 * @param mnemonic - BIP39 mnemonic phrase
 * @param passphrase - Optional BIP39 passphrase
 * @returns 128-character hex string (64 bytes)
 */
export function mnemonicToBIP39Seed(mnemonic: string, passphrase: string = ''): string {
  if (!bip39.validateMnemonic(mnemonic, wordlist)) {
    throw new Error('Invalid mnemonic phrase');
  }
  const seed = bip39.mnemonicToSeedSync(mnemonic, passphrase);
  return bytesToHex(seed);
}
