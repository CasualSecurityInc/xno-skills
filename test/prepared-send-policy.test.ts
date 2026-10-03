import { describe, expect, it } from 'vitest';
import { nanoToRaw } from '../src/convert.js';
import { publicKeyToNanoAddress } from '../src/nano-address.js';
import { PreparedBlockPolicyError, validatePreparedBlockPolicy } from '../src/prepared-send-policy.js';
import type { AccountInfoResponse } from '../src/rpc.js';
import type { StateBlockHashInput } from '../src/state-block.js';

const PUBKEY = '19d3d919475deed4696b5d13018151d1af88b2bd3bcff048b45031c1f36d1858';
const OTHER_PUBKEY = '0e8f7825fe07a6abd9f264a3e7831c117775c83aa18b601bf90df7ec851331ff';
const ADDRESS = publicKeyToNanoAddress(PUBKEY);
const FRONTIER = 'ab'.repeat(32);
const CURRENT = nanoToRaw('3');
const info = { frontier: FRONTIER, balance: CURRENT } as AccountInfoResponse;

function block(nextXno: string): StateBlockHashInput {
  return {
    accountPublicKey: PUBKEY,
    previous: FRONTIER,
    representativePublicKey: PUBKEY,
    balanceRaw: nanoToRaw(nextXno),
    link: OTHER_PUBKEY,
  };
}

describe('validatePreparedBlockPolicy', () => {
  it('allows a fresh prepared send within maxSendXno', () => {
    const result = validatePreparedBlockPolicy(block('2.5'), ADDRESS, info, '1', 'send');
    expect(result.amountRaw).toBe(nanoToRaw('0.5'));
  });

  it('blocks a prepared send that bypasses maxSendXno with a stable error code', () => {
    let thrown: unknown;
    try {
      validatePreparedBlockPolicy(block('1'), ADDRESS, info, '1', 'send');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(PreparedBlockPolicyError);
    expect((thrown as PreparedBlockPolicyError).code).toBe('MAX_SEND_EXCEEDED');
    expect((thrown as Error).message).toMatch(/exceeds maxSendXno/i);
  });

  it('blocks relabeling an oversized send as a receive', () => {
    expect(() => validatePreparedBlockPolicy(block('1'), ADDRESS, info, '1', 'receive')).toThrow(/implies send/i);
  });

  it('blocks a prepared block for another wallet account', () => {
    expect(() =>
      validatePreparedBlockPolicy({ ...block('2.5'), accountPublicKey: OTHER_PUBKEY }, ADDRESS, info, '1', 'send'),
    ).toThrow(/does not match/i);
  });

  it('blocks a stale prepared block', () => {
    expect(() =>
      validatePreparedBlockPolicy({ ...block('2.5'), previous: 'cd'.repeat(32) }, ADDRESS, info, '1', 'send'),
    ).toThrow(/stale/i);
  });

  it('requires receive subtype when prepared balance increases', () => {
    expect(validatePreparedBlockPolicy(block('3.5'), ADDRESS, info, '1', 'receive').actualSubtype).toBe('receive');
    expect(() => validatePreparedBlockPolicy(block('3.5'), ADDRESS, info, '1', 'change')).toThrow(/implies receive/i);
  });

  it('requires change subtype when prepared balance is unchanged', () => {
    expect(validatePreparedBlockPolicy(block('3'), ADDRESS, info, '1', 'change').actualSubtype).toBe('change');
    expect(() => validatePreparedBlockPolicy(block('3'), ADDRESS, info, '1', 'receive')).toThrow(/implies change/i);
  });

  it('only permits open blocks with a zero previous hash', () => {
    const openBlock = { ...block('1'), previous: '0'.repeat(64) };
    expect(validatePreparedBlockPolicy(openBlock, ADDRESS, null, '1', 'open').actualSubtype).toBe('open');
    expect(() => validatePreparedBlockPolicy(block('1'), ADDRESS, null, '1', 'open')).toThrow(/zero previous/i);
  });
});
