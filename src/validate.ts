import { decodeNanoAddress } from './nano-address.js';

export interface ValidateAddressResult {
  valid: boolean;
  publicKey?: string;
  error?: string;
}

export function validateAddress(address: string): ValidateAddressResult {
  // Check if it's a raw public key (64 hex characters)
  if (/^[0-9A-Fa-f]{64}$/.test(address)) {
    return { valid: true, publicKey: address.toLowerCase() };
  }

  try {
    const decoded = decodeNanoAddress(address);
    return { valid: true, publicKey: decoded.publicKey };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
