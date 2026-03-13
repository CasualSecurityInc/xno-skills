import { base32Decode } from './base32.js';
import { blake2b } from '@noble/hashes/blake2b.js';
import { bytesToHex } from '@noble/hashes/utils.js';

export interface ValidateAddressResult {
  valid: boolean;
  publicKey?: string;
  error?: string;
}

export function validateAddress(address: string): ValidateAddressResult {
  const validPrefixes = ['nano_', 'xrb_'];
  const hasValidPrefix = validPrefixes.some(prefix => address.startsWith(prefix));
  
  if (!hasValidPrefix) {
    return {
      valid: false,
      error: `Invalid prefix. Address must start with 'nano_' or 'xrb_'.`,
    };
  }

  const prefix = address.startsWith('nano_') ? 'nano_' : 'xrb_';
  const payload = address.slice(prefix.length);

  if (payload.length !== 60) {
    return {
      valid: false,
      error: `Invalid length. Address must be 65 characters (5 prefix + 60 base32), got ${address.length}.`,
    };
  }

  let decoded: Uint8Array;
  try {
    decoded = base32Decode(payload);
  } catch (e) {
    return {
      valid: false,
      error: `Invalid base32 encoding: ${e instanceof Error ? e.message : 'Unknown error'}.`,
    };
  }

  if (decoded.length !== 37) {
    return {
      valid: false,
      error: `Invalid payload length. Expected 37 bytes (32 public key + 5 checksum), got ${decoded.length}.`,
    };
  }

  const publicKeyBytesReversed = decoded.slice(0, 32);
  const publicKeyBytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    publicKeyBytes[i] = publicKeyBytesReversed[31 - i];
  }
  const checksumBytesReversed = decoded.slice(32, 37);
  const checksumBytes = new Uint8Array(5);
  for (let i = 0; i < 5; i++) {
    checksumBytes[i] = checksumBytesReversed[4 - i];
  }

  const expectedChecksum = blake2b(publicKeyBytes, { dkLen: 5 });

  let checksumValid = true;
  for (let i = 0; i < 5; i++) {
    if (checksumBytes[i] !== expectedChecksum[i]) {
      checksumValid = false;
      break;
    }
  }

  if (!checksumValid) {
    return {
      valid: false,
      error: `Invalid checksum. Address verification failed.`,
    };
  }

  return {
    valid: true,
    publicKey: bytesToHex(publicKeyBytes),
  };
}
