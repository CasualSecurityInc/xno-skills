import { describe, it, expect } from 'vitest';
import { generateAsciiQr, generateSvgQr, buildNanoUri } from '../src/qr';

// Real, checksum-valid addresses. The previous fixtures (`nano_1iuf5k3a4gd5a8h9j0…`)
// contained `0` and `1`, which are not in the Nano base32 alphabet — they only ever
// passed because formatNanoUri did not validate anything. Now that it does, a QR can
// only be built from an address that could actually receive a payment.
const ADDRESS = 'nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss';
const ADDRESS_2 = 'nano_1xug1q5t7nxoj3ywwzokiea9jz8fq8qfgzp8pbyfr3co3e5xgj755uofu8ue';
const ADDRESS_XRB = 'xrb_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss';
const HEX64 = 'a'.repeat(64);

describe('generateAsciiQr', () => {
  it('should generate ASCII QR code for address only', async () => {
    const result = await generateAsciiQr(ADDRESS);
    expect(result).toContain('█');
    expect(result).toContain('▄');
    expect(result.length).toBeGreaterThan(100);
  });

  it('should generate ASCII QR code with amount in URI', async () => {
    const result = await generateAsciiQr(ADDRESS, 1.5);
    expect(result).toContain('█');
    expect(result).toContain('▄');
    expect(result.length).toBeGreaterThan(100);
    expect(result.length).toBeGreaterThan((await generateAsciiQr(ADDRESS)).length);
  });

  it('should handle zero amount as no amount parameter', async () => {
    const resultNoAmount = await generateAsciiQr(ADDRESS);
    const resultZeroAmount = await generateAsciiQr(ADDRESS, 0);
    expect(resultZeroAmount).toBe(resultNoAmount);
  });

  it('should handle small amounts correctly', async () => {
    const result = await generateAsciiQr(ADDRESS, 0.000000001);
    expect(result).toContain('█');
    expect(result).toContain('▄');
  });

  it('should handle xrb_ prefix addresses', async () => {
    const result = await generateAsciiQr(ADDRESS_XRB);
    expect(result).toContain('█');
    expect(result).toContain('▄');
  });

  it('should return different QR codes for different addresses', async () => {
    const result1 = await generateAsciiQr(ADDRESS);
    const result2 = await generateAsciiQr(ADDRESS_2);
    expect(result1).not.toBe(result2);
  });
});

describe('QR codes refuse values that are not addresses', () => {
  // A bare 64-hex string is a 32-byte value: a public key, a block hash, a seed or a
  // private key. All four are indistinguishable from the value alone, and none of them
  // can receive a payment — `util_qr <block hash>` used to render a scannable code that
  // pays nothing. Refuse at the library boundary so the CLI, the MCP tool and anything
  // importing buildNanoUri are all covered by one check.
  it('buildNanoUri rejects a 64-hex value', () => {
    expect(() => buildNanoUri(HEX64)).toThrow(/must encode a Nano address/);
  });

  it('buildNanoUri rejects a 64-hex value even with an amount', () => {
    expect(() => buildNanoUri(HEX64, 1)).toThrow(/must encode a Nano address/);
  });

  it('generateAsciiQr rejects a 64-hex value', () => {
    // generateAsciiQr returns a Promise, but formatNanoUri runs synchronously before any
    // await, so a refused input throws out of the call itself rather than rejecting a
    // promise. Callers that wrap the call in try/catch (the CLI does) see it either way;
    // asserting the throw pins the actual behaviour.
    expect(() => generateAsciiQr(HEX64)).toThrow(/must encode a Nano address/);
  });

  it('generateSvgQr rejects a 64-hex value', () => {
    expect(() => generateSvgQr(HEX64)).toThrow(/must encode a Nano address/);
  });

  it('buildNanoUri rejects an invalid address', () => {
    expect(() => buildNanoUri('not an address')).toThrow(/Invalid address/);
  });

  it('buildNanoUri still accepts a valid address', () => {
    expect(buildNanoUri(ADDRESS)).toBe(`nano:${ADDRESS}`);
  });
});
