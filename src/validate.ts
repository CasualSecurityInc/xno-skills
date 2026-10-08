import { decodeNanoAddress } from './nano-address.js';

export interface ValidateAddressResult {
  valid: boolean;
  publicKey?: string;
  error?: string;
}

export function validateAddress(address: string): ValidateAddressResult {
  try {
    const decoded = decodeNanoAddress(address);
    return { valid: true, publicKey: decoded.publicKey };
  } catch (e) {
    return { valid: false, error: e instanceof Error ? e.message : 'Unknown error' };
  }
}
