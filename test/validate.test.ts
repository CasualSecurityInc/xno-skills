import { describe, it, expect } from 'vitest';
import { validateAddress } from '../src/validate';
import { publicKeyToAddress, deriveAddressLegacy } from '../src/address-legacy';

describe('validateAddress', () => {
  describe('valid addresses', () => {
    it('should validate a valid address generated from publicKeyToAddress', () => {
      const publicKey = '5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4';
      const address = publicKeyToAddress(publicKey);
      const result = validateAddress(address);
      expect(result.valid).toBe(true);
      expect(result.publicKey).toBe(publicKey.toLowerCase());
    });

    it('should validate a valid address from deriveAddressLegacy', () => {
      const seed = '0000000000000000000000000000000000000000000000000000000000000000';
      const { address, publicKey } = deriveAddressLegacy(seed, 0);
      const result = validateAddress(address);
      expect(result.valid).toBe(true);
      expect(result.publicKey).toBe(publicKey);
    });

    it('should validate xrb_ prefix address', () => {
      const publicKey = '5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4';
      const address = `xrb_${publicKeyToAddress(publicKey).slice(5)}`;
      const result = validateAddress(address);
      expect(result.valid).toBe(true);
      expect(result.publicKey).toBe(publicKey.toLowerCase());
    });
  });

  describe('invalid prefix', () => {
    it('should reject address with no prefix', () => {
      const result = validateAddress('1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t1u2v3w4x5y6z7a8b9c');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid prefix');
      expect(result.error).toContain("nano_");
      expect(result.error).toContain("xrb_");
    });

    it('should reject address with unknown prefix', () => {
      const result = validateAddress('bad_prefix123456789012345678901234567890123456789012345678901234');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid prefix');
    });
  });

  describe('invalid length', () => {
    it('should reject address that is too short', () => {
      const result = validateAddress('nano_1a2b3c4d5e');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid length');
      expect(result.error).toContain('65');
    });

    it('should reject address that is too long', () => {
      const result = validateAddress('nano_13456789abcdefghijkmnopqrstuwxyz13456789abcdefghijkmnopqrstuvwxyz1');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid length');
      expect(result.error).toContain('65');
    });

    it('should reject address with 59 characters', () => {
      const result = validateAddress('nano_13456789abcdefghijkmnopqrstuwxyz13456789abcdefghijkmnopq');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid length');
    });

    it('should reject address with 61 characters', () => {
      const result = validateAddress('nano_13456789abcdefghijkmnopqrstuwxyz13456789abcdefghijkmnopqrstuv');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid length');
    });
  });

  describe('invalid base32 encoding', () => {
    it('should reject address with invalid base32 character 0', () => {
      const result = validateAddress('nano_0' + 'a'.repeat(59));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid base32 encoding');
    });

    it('should reject address with invalid base32 character O', () => {
      const result = validateAddress('nano_O' + 'a'.repeat(59));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid base32 encoding');
    });

    it('should reject address with invalid base32 character I', () => {
      const result = validateAddress('nano_I' + 'a'.repeat(59));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid base32 encoding');
    });
  });

  describe('invalid checksum', () => {
    it('should reject address with wrong checksum', () => {
      const validAddress = publicKeyToAddress('5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4');
      const corruptedAddress = validAddress.slice(0, -1) + '1';
      const result = validateAddress(corruptedAddress);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid checksum');
    });

    it('should reject address with all zeros public key but wrong checksum', () => {
      const result = validateAddress('nano_' + '1'.repeat(60));
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid checksum');
    });
  });

  describe('return type', () => {
    it('should return correct structure for valid address', () => {
      const publicKey = '5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4';
      const address = publicKeyToAddress(publicKey);
      const result = validateAddress(address);
      expect(result.valid).toBe(true);
      expect(result.publicKey).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should return correct structure for invalid address', () => {
      const result = validateAddress('invalid');
      expect(result.valid).toBe(false);
      expect(result.publicKey).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });
});
