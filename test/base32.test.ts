import { describe, it, expect } from 'vitest';
import { base32Encode, base32Decode } from '../src/base32';

describe('base32Encode', () => {
  describe('basic encoding', () => {
    it('should encode empty array to empty string', () => {
      expect(base32Encode(new Uint8Array([]))).toBe('');
    });

    it('should encode single byte 0x00 to "11" (8 bits = 2 five-bit chars)', () => {
      expect(base32Encode(new Uint8Array([0x00]))).toBe('11');
    });

    it('should encode single byte 0xff correctly', () => {
      const result = base32Encode(new Uint8Array([0xff]));
      expect(result.length).toBe(2);
    });

    it('should encode single byte 0x01 correctly', () => {
      const result = base32Encode(new Uint8Array([0x01]));
      expect(result.length).toBe(2);
    });
  });

  describe('character set mapping', () => {
    it('should use Nano character set (not RFC4648)', () => {
      const charset = '13456789abcdefghijkmnopqrstuwxyz';
      expect(base32Encode(new Uint8Array([0x00]))[0]).toBe('1');
      expect(charset).toHaveLength(32);
    });

    it('should encode all 32 possible 5-bit values', () => {
      const charset = '13456789abcdefghijkmnopqrstuwxyz';
      // Test that each character in the charset can be produced
      for (let i = 0; i < 32; i++) {
        // Create a byte that will produce this 5-bit value
        const byte = i << 3; // Shift left by 3 to align 5-bit value at start
        const encoded = base32Encode(new Uint8Array([byte]));
        expect(encoded[0]).toBe(charset[i]);
      }
    });
  });

  describe('multi-byte encoding', () => {
    it('should encode two bytes correctly', () => {
      const result = base32Encode(new Uint8Array([0x00, 0x00]));
      expect(result.length).toBe(4);
    });

    it('should encode bytes requiring padding', () => {
      // 1 byte = 8 bits = 1 complete 5-bit chunk + 3 remaining bits
      // 2 bytes = 16 bits = 3 complete 5-bit chunks + 1 remaining bit
      // 3 bytes = 24 bits = 4 complete 5-bit chunks + 4 remaining bits
      // 4 bytes = 32 bits = 6 complete 5-bit chunks + 2 remaining bits
      // 5 bytes = 40 bits = 8 complete 5-bit chunks
      
      const input = new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff]);
      const encoded = base32Encode(input);
      expect(encoded.length).toBe(8);
    });

    it('should encode 32-byte array (Nano public key size)', () => {
      const input = new Uint8Array(32).fill(0xff);
      const encoded = base32Encode(input);
      // 32 bytes = 256 bits = 51 complete 5-bit chunks + 1 remaining bit
      // So we expect 52 characters
      expect(encoded.length).toBe(52);
    });
  });

  describe('roundtrip encoding', () => {
    it('should roundtrip random bytes', () => {
      const randomBytes = new Uint8Array([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0]);
      const encoded = base32Encode(randomBytes);
      const decoded = base32Decode(encoded);
      expect(decoded).toEqual(randomBytes);
    });

    it('should roundtrip all zeros', () => {
      const zeros = new Uint8Array(32).fill(0);
      const encoded = base32Encode(zeros);
      const decoded = base32Decode(encoded);
      expect(decoded).toEqual(zeros);
    });

    it('should roundtrip all ones', () => {
      const ones = new Uint8Array(32).fill(0xff);
      const encoded = base32Encode(ones);
      const decoded = base32Decode(encoded);
      expect(decoded).toEqual(ones);
    });

    it('should roundtrip alternating pattern', () => {
      const pattern = new Uint8Array([0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55, 0xaa, 0x55]);
      const encoded = base32Encode(pattern);
      const decoded = base32Decode(encoded);
      expect(decoded).toEqual(pattern);
    });
  });

  describe('Nano address encoding', () => {
    it('should encode known Nano address components', () => {
      // Test vector from Nano docs
      // Public key: 5b65b0e8173ee0802c2c3e6c9080d1a16b06de1176c938a924f58670904e82c4
      // This should encode to a specific base32 string
      const publicKey = new Uint8Array([
        0x5b, 0x65, 0xb0, 0xe8, 0x17, 0x3e, 0xe0, 0x80,
        0x2c, 0x2c, 0x3e, 0x6c, 0x90, 0x80, 0xd1, 0xa1,
        0x6b, 0x06, 0xde, 0x11, 0x76, 0xc9, 0x38, 0xa9,
        0x24, 0xf5, 0x86, 0x70, 0x90, 0x4e, 0x82, 0xc4
      ]);
      const encoded = base32Encode(publicKey);
      // The encoded string should be 52 characters (256 bits / 5 bits per char, rounded up)
      expect(encoded.length).toBe(52);
      // Verify it only contains valid characters
      const validChars = '13456789abcdefghijkmnopqrstuwxyz';
      for (const char of encoded) {
        expect(validChars).toContain(char);
      }
    });
  });
});

describe('base32Decode', () => {
  describe('basic decoding', () => {
    it('should decode empty string to empty array', () => {
      expect(base32Decode('')).toEqual(new Uint8Array(0));
    });

    it('should decode "11" to Uint8Array([0x00])', () => {
      expect(base32Decode('11')).toEqual(new Uint8Array([0x00]));
    });

    it('should decode "zz" correctly', () => {
      const result = base32Decode('zz');
      expect(result.length).toBe(1);
      expect(result[0]).toBe(0xff);
    });

    it('should decode single character to empty array (not enough bits)', () => {
      expect(base32Decode('1')).toEqual(new Uint8Array(0));
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid character "0"', () => {
      expect(() => base32Decode('0')).toThrow(/Invalid Base32 character '0'/);
    });

    it('should throw error for invalid character "O"', () => {
      expect(() => base32Decode('O')).toThrow(/Invalid Base32 character 'O'/);
    });

    it('should throw error for invalid character "I"', () => {
      expect(() => base32Decode('I')).toThrow(/Invalid Base32 character 'I'/);
    });

    it('should throw error for invalid character "l"', () => {
      expect(() => base32Decode('l')).toThrow(/Invalid Base32 character 'l'/);
    });

    it('should throw error for invalid character "2"', () => {
      expect(() => base32Decode('2')).toThrow(/Invalid Base32 character '2'/);
    });

    it('should throw error with position information', () => {
      expect(() => base32Decode('abc0def')).toThrow(/at position 3/);
    });

    it('should throw error listing valid characters', () => {
      try {
        base32Decode('invalid');
      } catch (e) {
        expect((e as Error).message).toContain('13456789abcdefghijkmnopqrstuwxyz');
      }
    });
  });

  describe('roundtrip decoding', () => {
    it('should roundtrip encoded string back to original bytes', () => {
      const original = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
      const encoded = base32Encode(original);
      const decoded = base32Decode(encoded);
      expect(decoded).toEqual(original);
    });

    it('should handle various byte lengths', () => {
      for (let len = 1; len <= 64; len++) {
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = (i * 7) % 256;
        }
        const encoded = base32Encode(bytes);
        const decoded = base32Decode(encoded);
        expect(decoded).toEqual(bytes);
      }
    });
  });

  describe('character set validation', () => {
    it('should accept all valid characters', () => {
      const validChars = '13456789abcdefghijkmnopqrstuwxyz';
      // Create a string with all valid characters
      const allChars = validChars.repeat(2);
      // Should not throw
      expect(() => base32Decode(allChars)).not.toThrow();
    });

    it('should reject uppercase letters (Nano uses lowercase)', () => {
      expect(() => base32Decode('A')).toThrow(/Invalid Base32 character 'A'/);
      expect(() => base32Decode('B')).toThrow(/Invalid Base32 character 'B'/);
    });
  });
});

describe('edge cases', () => {
  it('should handle maximum byte values', () => {
    const maxBytes = new Uint8Array([0xff, 0xff, 0xff, 0xff]);
    const encoded = base32Encode(maxBytes);
    const decoded = base32Decode(encoded);
    expect(decoded).toEqual(maxBytes);
  });

  it('should handle minimum byte values', () => {
    const minBytes = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const encoded = base32Encode(minBytes);
    const decoded = base32Decode(encoded);
    expect(decoded).toEqual(minBytes);
  });

  it('should handle mixed byte values', () => {
    const mixedBytes = new Uint8Array([0x00, 0xff, 0x00, 0xff, 0x00, 0xff]);
    const encoded = base32Encode(mixedBytes);
    const decoded = base32Decode(encoded);
    expect(decoded).toEqual(mixedBytes);
  });

  it('should handle single byte correctly', () => {
    for (let i = 0; i < 256; i++) {
      const byte = new Uint8Array([i]);
      const encoded = base32Encode(byte);
      const decoded = base32Decode(encoded);
      expect(decoded).toEqual(byte);
    }
  });

  it('should produce consistent results for same input', () => {
    const input = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    const encoded1 = base32Encode(input);
    const encoded2 = base32Encode(input);
    expect(encoded1).toBe(encoded2);
  });
});

describe('Nano-specific behavior', () => {
  it('should use correct character set (excludes 0, O, I, l, 2)', () => {
    const charset = '13456789abcdefghijkmnopqrstuwxyz';
    const excludedChars = ['0', 'O', 'I', 'l', '2'];
    
    const testBytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) {
      testBytes[i] = i;
    }
    const encoded = base32Encode(testBytes);
    
    for (const char of excludedChars) {
      expect(encoded).not.toContain(char);
    }
    
    for (const char of encoded) {
      expect(charset).toContain(char);
    }
  });

  it('should match Nano address regex pattern', () => {
    // Nano addresses use: [13456789abcdefghijkmnopqrstuwxyz]{59}
    // This regex matches the character set we use
    const charset = '13456789abcdefghijkmnopqrstuwxyz';
    const regex = new RegExp(`^[${charset}]+$`);
    
    // Test various encodings
    for (let len = 1; len <= 64; len++) {
      const bytes = new Uint8Array(len).fill(0xab);
      const encoded = base32Encode(bytes);
      expect(regex.test(encoded)).toBe(true);
    }
  });
});