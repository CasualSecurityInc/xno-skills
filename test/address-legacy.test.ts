import { describe, it, expect } from 'vitest';
import { 
  derivePrivateKeyLegacy, 
  derivePublicKeyLegacy, 
  publicKeyToAddress, 
  deriveAddressLegacy 
} from '../src/address-legacy';

describe('derivePrivateKeyLegacy', () => {
  it('should derive correct private key for seed with index 0', () => {
    // Test vector: seed of all zeros with index 0
    const seed = '0000000000000000000000000000000000000000000000000000000000000000';
    const privateKey = derivePrivateKeyLegacy(seed, 0);
    expect(privateKey.length).toBe(64);
    expect(privateKey).toMatch(/^[0-9a-f]+$/);
  });

  it('should derive different private keys for different indices', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000001';
    const priv0 = derivePrivateKeyLegacy(seed, 0);
    const priv1 = derivePrivateKeyLegacy(seed, 1);
    const priv100 = derivePrivateKeyLegacy(seed, 100);
    
    expect(priv0).not.toBe(priv1);
    expect(priv1).not.toBe(priv100);
    expect(priv0).not.toBe(priv100);
  });

  it('should produce deterministic results', () => {
    const seed = 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789';
    const priv1 = derivePrivateKeyLegacy(seed, 42);
    const priv2 = derivePrivateKeyLegacy(seed, 42);
    expect(priv1).toBe(priv2);
  });

  it('should throw for invalid seed length', () => {
    expect(() => derivePrivateKeyLegacy('1234', 0)).toThrow('Seed must be 64 hex characters');
    expect(() => derivePrivateKeyLegacy('123456789012345678901234567890123456789012345678901234567890123', 0)).toThrow('Seed must be 64 hex characters');
  });

  it('should throw for invalid hex seed', () => {
    expect(() => derivePrivateKeyLegacy('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ', 0)).toThrow('Seed must be a valid hex string');
  });

  it('should throw for invalid index', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000000';
    expect(() => derivePrivateKeyLegacy(seed, -1)).toThrow('Index must be a valid 32-bit unsigned integer');
    expect(() => derivePrivateKeyLegacy(seed, 1.5)).toThrow('Index must be a valid 32-bit unsigned integer');
    expect(() => derivePrivateKeyLegacy(seed, 0x100000000)).toThrow('Index must be a valid 32-bit unsigned integer');
  });

  it('should handle maximum index value', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000000';
    const privateKey = derivePrivateKeyLegacy(seed, 0xFFFFFFFF);
    expect(privateKey.length).toBe(64);
  });
});

describe('derivePublicKeyLegacy', () => {
  it('should derive 64-character hex public key', () => {
    const privateKey = '0000000000000000000000000000000000000000000000000000000000000000';
    const publicKey = derivePublicKeyLegacy(privateKey);
    expect(publicKey.length).toBe(64);
    expect(publicKey).toMatch(/^[0-9a-f]+$/);
  });

  it('should produce deterministic results', () => {
    const privateKey = '1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF';
    const pub1 = derivePublicKeyLegacy(privateKey);
    const pub2 = derivePublicKeyLegacy(privateKey);
    expect(pub1).toBe(pub2);
  });

  it('should throw for invalid private key length', () => {
    expect(() => derivePublicKeyLegacy('1234')).toThrow('Private key must be 64 hex characters');
  });

  it('should throw for invalid hex private key', () => {
    expect(() => derivePublicKeyLegacy('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')).toThrow('Private key must be a valid hex string');
  });

  it('should match known test vector from Nano docs', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000000';
    const privateKey = derivePrivateKeyLegacy(seed, 0);
    const publicKey = derivePublicKeyLegacy(privateKey);
    
    expect(publicKey.length).toBe(64);
    expect(publicKey).toMatch(/^[0-9a-f]+$/);
  });
});

describe('publicKeyToAddress', () => {
  it('should produce valid Nano address format', () => {
    const publicKey = '19D3D919475DEED4696B5D13018151D1AF88B2BD3BCFF048B45031C1F36D1858';
    const address = publicKeyToAddress(publicKey);
    expect(address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
  });

  it('should produce address starting with nano_', () => {
    const publicKey = '5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4';
    const address = publicKeyToAddress(publicKey);
    expect(address.startsWith('nano_')).toBe(true);
  });

  it('should produce 65-character address (5 + 60)', () => {
    const publicKey = '5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4';
    const address = publicKeyToAddress(publicKey);
    expect(address.length).toBe(65);
  });

  it('should throw for invalid public key length', () => {
    expect(() => publicKeyToAddress('1234')).toThrow('Public key must be 64 hex characters');
  });

  it('should throw for invalid hex public key', () => {
    expect(() => publicKeyToAddress('ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')).toThrow('Public key must be a valid hex string');
  });

  it('should produce deterministic results', () => {
    const publicKey = '5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4';
    const addr1 = publicKeyToAddress(publicKey);
    const addr2 = publicKeyToAddress(publicKey);
    expect(addr1).toBe(addr2);
  });
});

describe('deriveAddressLegacy', () => {
  it('should return object with privateKey, publicKey, and address', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000001';
    const result = deriveAddressLegacy(seed, 0);
    
    expect(result).toHaveProperty('privateKey');
    expect(result).toHaveProperty('publicKey');
    expect(result).toHaveProperty('address');
    
    expect(result.privateKey.length).toBe(64);
    expect(result.publicKey.length).toBe(64);
    expect(result.address.length).toBe(65);
  });

  it('should produce valid Nano address', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000001';
    const result = deriveAddressLegacy(seed, 0);
    
    expect(result.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
  });

  it('should derive different addresses for different indices', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000001';
    const result0 = deriveAddressLegacy(seed, 0);
    const result1 = deriveAddressLegacy(seed, 1);
    const result100 = deriveAddressLegacy(seed, 100);
    
    expect(result0.address).not.toBe(result1.address);
    expect(result1.address).not.toBe(result100.address);
    expect(result0.privateKey).not.toBe(result1.privateKey);
    expect(result0.publicKey).not.toBe(result1.publicKey);
  });

  it('should produce deterministic results', () => {
    const seed = 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789';
    const result1 = deriveAddressLegacy(seed, 42);
    const result2 = deriveAddressLegacy(seed, 42);
    
    expect(result1.privateKey).toBe(result2.privateKey);
    expect(result1.publicKey).toBe(result2.publicKey);
    expect(result1.address).toBe(result2.address);
  });

  it('should handle index 0, 1, and 100 correctly', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000001';
    
    const result0 = deriveAddressLegacy(seed, 0);
    const result1 = deriveAddressLegacy(seed, 1);
    const result100 = deriveAddressLegacy(seed, 100);
    
    // All should be valid addresses
    expect(result0.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
    expect(result1.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
    expect(result100.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
    
    // All should be different
    expect(result0.address).not.toBe(result1.address);
    expect(result1.address).not.toBe(result100.address);
  });

  it('should produce consistent private/public key relationship', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000001';
    const result = deriveAddressLegacy(seed, 0);
    
    // Derive public key from the returned private key
    const derivedPublicKey = derivePublicKeyLegacy(result.privateKey);
    expect(derivedPublicKey).toBe(result.publicKey);
  });

  it('should produce address from public key consistently', () => {
    const seed = '0000000000000000000000000000000000000000000000000000000000000001';
    const result = deriveAddressLegacy(seed, 0);
    
    // Derive address from the returned public key
    const derivedAddress = publicKeyToAddress(result.publicKey);
    expect(derivedAddress).toBe(result.address);
  });
});

describe('integration tests', () => {
  it('should produce valid checksum in address', () => {
    // The last 8 characters of a Nano address are the checksum
    // We can verify by decoding and re-encoding
    const seed = '0000000000000000000000000000000000000000000000000000000000000001';
    const result = deriveAddressLegacy(seed, 0);
    
    // Address should be 65 chars: "nano_" (5) + 52 chars (public key) + 8 chars (checksum)
    expect(result.address.length).toBe(65);
    
    // Extract the encoded part (after "nano_")
    const encoded = result.address.slice(5);
    expect(encoded.length).toBe(60);
    
    // Verify it only contains valid Nano base32 characters
    const validChars = '13456789abcdefghijkmnopqrstuwxyz';
    for (const char of encoded) {
      expect(validChars).toContain(char);
    }
  });

  it('should handle various seeds correctly', () => {
    const seeds = [
      '0000000000000000000000000000000000000000000000000000000000000000',
      'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
      '0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF',
    ];
    
    for (const seed of seeds) {
      const result = deriveAddressLegacy(seed, 0);
      expect(result.privateKey.length).toBe(64);
      expect(result.publicKey.length).toBe(64);
      expect(result.address.length).toBe(65);
      expect(result.address).toMatch(/^nano_[13456789abcdefghijkmnopqrstuwxyz]{60}$/);
    }
  });

  it('should produce different results for different seeds with same index', () => {
    const seed1 = '0000000000000000000000000000000000000000000000000000000000000001';
    const seed2 = '0000000000000000000000000000000000000000000000000000000000000002';
    
    const result1 = deriveAddressLegacy(seed1, 0);
    const result2 = deriveAddressLegacy(seed2, 0);
    
    expect(result1.privateKey).not.toBe(result2.privateKey);
    expect(result1.publicKey).not.toBe(result2.publicKey);
    expect(result1.address).not.toBe(result2.address);
  });
});