import { describe, it, expect } from 'vitest';
import { localWorkGenerate, getThresholdForSubtype, validateWork } from '../src/pow';

describe('Local PoW', () => {
  it('should detect broken WASM backend (all-zero nonce)', async () => {
    const hash = 'BD9F737DDECB0A34DFBA0EDF7017ACB0EF0AA04A6F7A73A406191EF80BB20000';
    await expect(localWorkGenerate(hash, 'send')).rejects.toThrow('all-zero nonce');
  }, 30000);

  it('should return correct threshold for subtype', () => {
    expect(getThresholdForSubtype('send')).toBe('send');
    expect(getThresholdForSubtype('change')).toBe('send');
    expect(getThresholdForSubtype('receive')).toBe('open');
    expect(getThresholdForSubtype('open')).toBe('open');
  });

  it('should throw for invalid hash', async () => {
    await expect(localWorkGenerate('invalid')).rejects.toThrow('work root/hash must be 32-byte hex');
  });

  describe('validateWork', () => {
    it('should accept valid work nonces', () => {
      expect(() => validateWork('ABCDEF1234567890')).not.toThrow();
      expect(() => validateWork('1111111111111111')).not.toThrow();
    });

    it('should reject all-zero nonce', () => {
      expect(() => validateWork('0000000000000000')).toThrow('all-zero nonce');
    });

    it('should reject invalid format', () => {
      expect(() => validateWork('short')).toThrow('16-char uppercase hex');
      expect(() => validateWork('')).toThrow('16-char uppercase hex');
    });
  });
});