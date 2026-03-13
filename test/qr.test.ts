import { describe, it, expect } from 'vitest';
import { generateAsciiQr } from '../src/qr';

describe('generateAsciiQr', () => {
  it('should generate ASCII QR code for address only', async () => {
    const address = 'nano_1iuf5k3a4gd5a8h9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1';
    const result = await generateAsciiQr(address);
    expect(result).toContain('█');
    expect(result).toContain('▄');
    expect(result.length).toBeGreaterThan(100);
  });

  it('should generate ASCII QR code with amount in URI', async () => {
    const address = 'nano_1iuf5k3a4gd5a8h9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1';
    const result = await generateAsciiQr(address, 1.5);
    expect(result).toContain('█');
    expect(result).toContain('▄');
    expect(result.length).toBeGreaterThan(100);
    expect(result.length).toBeGreaterThan((await generateAsciiQr(address)).length);
  });

  it('should handle zero amount as no amount parameter', async () => {
    const address = 'nano_1iuf5k3a4gd5a8h9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1';
    const resultNoAmount = await generateAsciiQr(address);
    const resultZeroAmount = await generateAsciiQr(address, 0);
    expect(resultZeroAmount).toBe(resultNoAmount);
  });

  it('should handle small amounts correctly', async () => {
    const address = 'nano_1iuf5k3a4gd5a8h9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1';
    const result = await generateAsciiQr(address, 0.000000001);
    expect(result).toContain('█');
    expect(result).toContain('▄');
  });

  it('should handle xrb_ prefix addresses', async () => {
    const address = 'xrb_1iuf5k3a4gd5a8h9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1';
    const result = await generateAsciiQr(address);
    expect(result).toContain('█');
    expect(result).toContain('▄');
  });

  it('should return different QR codes for different addresses', async () => {
    const address1 = 'nano_1iuf5k3a4gd5a8h9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1';
    const address2 = 'nano_1abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz1234567';
    const result1 = await generateAsciiQr(address1);
    const result2 = await generateAsciiQr(address2);
    expect(result1).not.toBe(result2);
  });
});