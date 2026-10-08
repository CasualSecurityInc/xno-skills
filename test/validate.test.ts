import { describe, it, expect } from 'vitest';
import { validateAddress } from '../src/validate';
import { decodeNanoAddress } from '../src/nano-address';

// A bare 64-hex value is not a Nano address. No wallet supports sending to an opaque hex
// string, and this one does not either: the input is rejected rather than labelled with a
// kind the function cannot actually determine. Reported as pursekeeper/skill item 5 /
// initiative #6.
const BLOCK_HASH = '752200407309C6F4844DD8A0D70FDAE5032E4D12A60048CC3313BBDCF4DAE7C5';
const ADDRESS = 'nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss';
const XRB_ADDRESS = 'xrb_1111111111111111111111111111111111111111111111111111hifc8npp';

describe('validateAddress', () => {
  it('recognises a Nano address and reports its public key', () => {
    const v = validateAddress(ADDRESS);
    expect(v.valid).toBe(true);
    expect(v.publicKey).toBe(decodeNanoAddress(ADDRESS).publicKey);
  });

  it('recognises the legacy xrb_ form', () => {
    const v = validateAddress(XRB_ADDRESS);
    expect(v.valid).toBe(true);
    expect(v.publicKey).toBe('0'.repeat(64));
  });

  it('rejects a bare 64-hex block hash', () => {
    const v = validateAddress(BLOCK_HASH);
    expect(v.valid).toBe(false);
    expect(v.error).toMatch(/prefix/i);
  });

  it('rejects a key-shaped 64-hex value', () => {
    const keyShaped = '0000000000000000000000000000000000000000000000000000000000000001';
    const v = validateAddress(keyShaped);
    expect(v.valid).toBe(false);
    expect(v.error).toMatch(/prefix/i);
  });

  it('rejects any 64-hex value, not just known shapes', () => {
    const arbitrary = 'abcdef'.repeat(10) + 'abcd';
    const v = validateAddress(arbitrary);
    expect(v.valid).toBe(false);
    expect(v.error).toMatch(/prefix/i);
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
});
