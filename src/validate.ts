import { decodeNanoAddress } from './nano-address.js';

export interface ValidateAddressResult {
  valid: boolean;
  publicKey?: string;
  error?: string;
  /**
   * What the input turned out to be. A bare 64-hex value is a public key (or any other
   * 32-byte value: a block hash, a seed, a private key); it is not an address and must not
   * be reported as one. `address` is set only when the input really is a Nano address.
   */
  kind?: 'address' | 'public-key';
  /** Present only when kind is 'address' — the input itself, normalised. */
  address?: string;
}

const HEX64 = /^[0-9A-Fa-f]{64}$/;

export function validateAddress(address: string): ValidateAddressResult {
  // A bare 64-hex string is a 32-byte value. A Nano public key is one of those, but so is a
  // block hash, a seed and a private key — they are indistinguishable by length, and this
  // function cannot tell them apart. Report it as a public key and let the caller decide;
  // never call it an address (an address is 65 chars and starts with nano_/xrb_).
  if (HEX64.test(address)) {
    return { valid: true, kind: 'public-key', publicKey: address.toLowerCase() };
  }

  try {
    const decoded = decodeNanoAddress(address);
    return { valid: true, kind: 'address', address, publicKey: decoded.publicKey };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
