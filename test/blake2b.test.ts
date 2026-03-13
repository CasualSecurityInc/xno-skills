import { describe, it, expect } from 'vitest';
import { blake2b256, blake2b512, blake2b256Hex } from '../src/blake2b';

const BLAKE2B_512_EMPTY = '786a02f742015903c6c6fd852552d272912f4740e15847618a86e217f71f5419d25e1031afee585313896444934eb04b903a685b1448b755d56f701afe9be2ce';
const BLAKE2B_256_EMPTY = '0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8';
const BLAKE2B_512ABC = 'ba80a53f981c4d0d6a2797b69f12f6e94c212f14685ac4b74b12bb6fdbffa2d17d87c5392aab792dc252d5de4533cc9518d38aa8dbf1925ab92386edd4009923';
const BLAKE2B_256ABC = 'bddd813c634239723171ef3fee98579b94964e3bb1cb3e427262c8c068d52319';

describe('blake2b256', () => {
  it('should return 32-byte hash', () => {
    const hash = blake2b256(new Uint8Array([0x61, 0x62, 0x63]));
    expect(hash.length).toBe(32);
  });

  it('should hash empty input correctly', () => {
    const hash = blake2b256(new Uint8Array([]));
    expect(hash.length).toBe(32);
  });

  it('should match known test vector for empty input', () => {
    const hash = blake2b256(new Uint8Array([]));
    const hex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe(BLAKE2B_256_EMPTY);
  });

  it('should match known test vector for "abc"', () => {
    const hash = blake2b256(new Uint8Array([0x61, 0x62, 0x63]));
    const hex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe(BLAKE2B_256ABC);
  });

  it('should produce deterministic output', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const hash1 = blake2b256(data);
    const hash2 = blake2b256(data);
    expect(hash1).toEqual(hash2);
  });
});

describe('blake2b512', () => {
  it('should return 64-byte hash', () => {
    const hash = blake2b512(new Uint8Array([0x61, 0x62, 0x63]));
    expect(hash.length).toBe(64);
  });

  it('should hash empty input correctly', () => {
    const hash = blake2b512(new Uint8Array([]));
    expect(hash.length).toBe(64);
  });

  it('should match known test vector for empty input', () => {
    const hash = blake2b512(new Uint8Array([]));
    const hex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe(BLAKE2B_512_EMPTY);
  });

  it('should match known test vector for "abc"', () => {
    const hash = blake2b512(new Uint8Array([0x61, 0x62, 0x63]));
    const hex = Array.from(hash).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(hex).toBe(BLAKE2B_512ABC);
  });

  it('should produce deterministic output', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const hash1 = blake2b512(data);
    const hash2 = blake2b512(data);
    expect(hash1).toEqual(hash2);
  });
});

describe('blake2b256Hex', () => {
  it('should return 64-character hex string', () => {
    const hex = blake2b256Hex(new Uint8Array([0x61, 0x62, 0x63]));
    expect(hex.length).toBe(64);
  });

  it('should match known test vector for empty input', () => {
    const hex = blake2b256Hex(new Uint8Array([]));
    expect(hex).toBe(BLAKE2B_256_EMPTY);
  });

  it('should match known test vector for "abc"', () => {
    const hex = blake2b256Hex(new Uint8Array([0x61, 0x62, 0x63]));
    expect(hex).toBe(BLAKE2B_256ABC);
  });

  it('should produce valid lowercase hex characters only', () => {
    const hex = blake2b256Hex(new Uint8Array([0xff, 0x00, 0xab]));
    expect(hex).toMatch(/^[0-9a-f]+$/);
  });

  it('should be equivalent to blake2b256 + bytesToHex', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    const hashBytes = blake2b256(data);
    const hexFromBytes = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const hexDirect = blake2b256Hex(data);
    expect(hexDirect).toBe(hexFromBytes);
  });
});

describe('hash consistency', () => {
  it('blake2b256 and blake2b512 should handle same input', () => {
    const data = new Uint8Array([0x61, 0x62, 0x63, 0x64, 0x65]);
    const hash256 = blake2b256(data);
    const hash512 = blake2b512(data);
    expect(hash256.length).toBe(32);
    expect(hash512.length).toBe(64);
    expect(hash256).not.toEqual(hash512);
  });

  it('should handle various input sizes', () => {
    for (let len = 0; len <= 256; len += 7) {
      const data = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        data[i] = i * 13 % 256;
      }
      const hash256 = blake2b256(data);
      const hash512 = blake2b512(data);
      expect(hash256.length).toBe(32);
      expect(hash512.length).toBe(64);
    }
  });
});
