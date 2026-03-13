import { describe, it, expect } from 'vitest';
import { generateSeed, seedToMnemonic, mnemonicToSeed, validateMnemonic } from '../src/seed';

describe('generateSeed', () => {
  it('should return 64-character hex string', () => {
    const seed = generateSeed();
    expect(seed.length).toBe(64);
  });

  it('should return valid lowercase hex characters only', () => {
    const seed = generateSeed();
    expect(seed).toMatch(/^[0-9a-f]+$/);
  });

  it('should generate unique seeds', () => {
    const seeds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seeds.add(generateSeed());
    }
    expect(seeds.size).toBe(100);
  });

  it('should generate cryptographically secure random values', () => {
    // Statistical test: each byte position should have variation across multiple seeds
    const seeds = Array.from({ length: 100 }, () => generateSeed());
    for (let bytePos = 0; bytePos < 32; bytePos++) {
      const byteValues = new Set<number>();
      for (const seed of seeds) {
        const byteHex = seed.slice(bytePos * 2, bytePos * 2 + 2);
        byteValues.add(parseInt(byteHex, 16));
      }
      // Each byte position should have at least 10 unique values across 100 seeds
      expect(byteValues.size).toBeGreaterThan(10);
    }
  });
});

describe('seedToMnemonic', () => {
  it('should convert 32-byte seed to 24-word mnemonic', () => {
    const seed = '0'.repeat(64);
    const mnemonic = seedToMnemonic(seed);
    const words = mnemonic.split(' ');
    expect(words.length).toBe(24);
  });

  it('should convert 16-byte seed to 12-word mnemonic', () => {
    const seed = '0'.repeat(32);
    const mnemonic = seedToMnemonic(seed);
    const words = mnemonic.split(' ');
    expect(words.length).toBe(12);
  });

  it('should produce valid BIP39 mnemonics', () => {
    const seed = generateSeed();
    const mnemonic = seedToMnemonic(seed);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('should throw on invalid hex string', () => {
    expect(() => seedToMnemonic('invalid')).toThrow();
  });

  it('should throw on odd-length hex string', () => {
    expect(() => seedToMnemonic('abc')).toThrow();
  });

  it('should handle known test vector', () => {
    // All zeros entropy should produce known mnemonic (last word depends on checksum)
    const seed = '0000000000000000000000000000000000000000000000000000000000000000';
    const mnemonic = seedToMnemonic(seed);
    expect(mnemonic).toBe(
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art'
    );
  });
});

describe('mnemonicToSeed', () => {
  it('should convert 24-word mnemonic back to seed', () => {
    const originalSeed = generateSeed();
    const mnemonic = seedToMnemonic(originalSeed);
    const recoveredSeed = mnemonicToSeed(mnemonic);
    expect(recoveredSeed).toBe(originalSeed);
  });

  it('should convert 12-word mnemonic back to seed', () => {
    const originalSeed = '0'.repeat(32); // 16 bytes = 12 words
    const mnemonic = seedToMnemonic(originalSeed);
    const recoveredSeed = mnemonicToSeed(mnemonic);
    expect(recoveredSeed).toBe(originalSeed);
  });

  it('should handle known test vector', () => {
    const mnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';
    const seed = mnemonicToSeed(mnemonic);
    expect(seed).toBe('0000000000000000000000000000000000000000000000000000000000000000');
  });

  it('should throw on invalid mnemonic', () => {
    expect(() => mnemonicToSeed('invalid mnemonic phrase')).toThrow();
  });

  it('should throw on mnemonic with invalid words', () => {
    expect(() => mnemonicToSeed('zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz zzzzzz')).toThrow();
  });
});

describe('roundtrip', () => {
  it('should maintain seed integrity through mnemonic conversion', () => {
    for (let i = 0; i < 10; i++) {
      const seed = generateSeed();
      const mnemonic = seedToMnemonic(seed);
      const recovered = mnemonicToSeed(mnemonic);
      expect(recovered).toBe(seed);
    }
  });

  it('should work with 12-word mnemonics', () => {
    for (let i = 0; i < 10; i++) {
      const seed = generateSeed().slice(0, 32); // 16 bytes = 12 words
      const mnemonic = seedToMnemonic(seed);
      const recovered = mnemonicToSeed(mnemonic);
      expect(recovered).toBe(seed);
    }
  });
});

describe('validateMnemonic', () => {
  it('should return true for valid 24-word mnemonic', () => {
    const seed = generateSeed();
    const mnemonic = seedToMnemonic(seed);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('should return true for valid 12-word mnemonic', () => {
    const seed = '0'.repeat(32);
    const mnemonic = seedToMnemonic(seed);
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('should return false for invalid mnemonic', () => {
    expect(validateMnemonic('invalid mnemonic phrase')).toBe(false);
  });

  it('should return false for mnemonic with wrong checksum', () => {
    const seed = generateSeed();
    const mnemonic = seedToMnemonic(seed);
    const words = mnemonic.split(' ');
    // Change last word to break checksum
    words[words.length - 1] = 'abandon';
    const invalidMnemonic = words.join(' ');
    expect(validateMnemonic(invalidMnemonic)).toBe(false);
  });
});

describe('security', () => {
  it('should never log seeds or mnemonics', () => {
    // This test ensures no console.log calls in the implementation
    const originalLog = console.log;
    const logs: string[] = [];
    console.log = (...args) => {
      logs.push(args.join(' '));
    };

    try {
      const seed = generateSeed();
      const mnemonic = seedToMnemonic(seed);
      void mnemonicToSeed(mnemonic);

      expect(logs.length).toBe(0);
      expect(logs.some(log => log.includes(seed))).toBe(false);
      expect(logs.some(log => log.includes(mnemonic))).toBe(false);
    } finally {
      console.log = originalLog;
    }
  });
});