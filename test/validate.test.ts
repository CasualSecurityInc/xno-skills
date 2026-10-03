import { describe, it, expect } from 'vitest';
import { validateAddress } from '../src/validate';
import { decodeNanoAddress } from '../src/nano-address';

// A bare 64-hex value is a 32-byte value. A Nano public key is one of those, but so is a
// block hash, a seed and a private key: they are indistinguishable by length. The command
// must not answer "valid Nano address" for such a value, and must not echo it as an
// address. Reported as pursekeeper/skill item 5 / initiative #6.
const BLOCK_HASH = '752200407309C6F4844DD8A0D70FDAE5032E4D12A60048CC3313BBDCF4DAE7C5';
const ADDRESS = 'nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss';
const XRB_ADDRESS = 'xrb_1111111111111111111111111111111111111111111111111111hifc8npp';

describe('validateAddress — kinds and the 64-hex branch', () => {
  it('recognises a Nano address and reports its public key', () => {
    const v = validateAddress(ADDRESS);
    expect(v.valid).toBe(true);
    expect(v.kind).toBe('address');
    expect(v.address).toBe(ADDRESS);
    expect(v.publicKey).toBe(decodeNanoAddress(ADDRESS).publicKey);
  });

  it('recognises the legacy xrb_ form', () => {
    const v = validateAddress(XRB_ADDRESS);
    expect(v.valid).toBe(true);
    expect(v.kind).toBe('address');
    expect(v.publicKey).toBe('0'.repeat(64));
  });

  it('does not call a bare 64-hex value an address', () => {
    const v = validateAddress(BLOCK_HASH);
    expect(v.valid).toBe(true);
    expect(v.kind).toBe('public-key');
    // The defect: the input used to come back in an `address` field, and the CLI printed
    // "Valid Nano address". A hash is not an address.
    expect(v.address).toBeUndefined();
    // And the value is not silently shaped into one either.
    expect(v.publicKey).toBe(BLOCK_HASH.toLowerCase());
    expect(() => decodeNanoAddress(BLOCK_HASH)).toThrow(/prefix/i);
  });

  it('treats a key-shaped 64-hex value the same way, and never echoes it as an address', () => {
    // The shape of a Nano private key / seed.
    const keyShaped = '0000000000000000000000000000000000000000000000000000000000000001';
    const v = validateAddress(keyShaped);
    expect(v.valid).toBe(true);
    expect(v.kind).toBe('public-key');
    expect(v.address).toBeUndefined();
  });

  it('the prefix requirement applies either side of 64 characters', () => {
    for (const input of ['a'.repeat(63), 'a'.repeat(65)]) {
      const v = validateAddress(input);
      expect(v.valid).toBe(false);
      expect(v.error).toMatch(/prefix/i);
    }
    const withPrefix = validateAddress(`nano_${'0'.repeat(64)}`);
    expect(withPrefix.valid).toBe(false);
    expect(withPrefix.error).toMatch(/length/i);
  });

  it('reports an unknown 64-hex value as a public-key kind, never as an address', () => {
    // Any 64-hex value at all — the branch is by length and shape, and that is exactly why
    // the label must not be "address".
    const arbitrary = 'abcdef'.repeat(10) + 'abcd'; // 64 hex
    const v = validateAddress(arbitrary);
    expect(v.valid).toBe(true);
    expect(v.kind).toBe('public-key');
    expect(v.address).toBeUndefined();
  });
});
