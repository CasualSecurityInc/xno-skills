import { describe, it, expect } from 'vitest';
import { localWorkGenerate, getThresholdForSubtype } from '../src/pow';

describe('Local PoW', () => {
  it('should generate valid work for a hash', async () => {
    // This is a real hash, but we just check if it returns a 16-char hex string
    const hash = 'BD9F737DDECB0A34DFBA0EDF7017ACB0EF0AA04A6F7A73A406191EF80BB20000';
    const result = await localWorkGenerate(hash, 'send');
    
    expect(result.work).toBeDefined();
    expect(result.work).toMatch(/^[0-9A-F]{16}$/);
  }, 30000); // 30s timeout for PoW

  it('should return correct threshold for subtype', () => {
    expect(getThresholdForSubtype('send')).toBe('send');
    expect(getThresholdForSubtype('change')).toBe('send');
    expect(getThresholdForSubtype('receive')).toBe('open');
    expect(getThresholdForSubtype('open')).toBe('open');
  });

  it('should throw for invalid hash', async () => {
    await expect(localWorkGenerate('invalid')).rejects.toThrow('work root/hash must be 32-byte hex');
  });
});