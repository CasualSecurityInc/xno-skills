import { describe, it, expect } from 'vitest';
import { getNanoAccountInfo, type NanoReaders } from '../src/nano-actions';
import type { AccountInfoResponse, NanoRpcErrorResponse } from '../src/rpc';
import { nanoToRaw, rawToNano } from '../src/convert';

// A valid address used across tests (same as rpc.test.ts, noms.test.ts, etc.)
const TEST_ADDRESS = 'nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d';

// Real-world test vectors captured from live RPC queries
const VECTORS = {
  smallBalance: {
    raw: '333520000000000000000000000000',
    xno: '0.33352',
  },
  oneXno: {
    raw: '1000000000000000000000000000000',
    xno: '1',
  },
  repBalance: {
    raw: '133457812034268817643554104418555',
    xno: '133.457812034268817643554104418555',
  },
  dustPending: {
    raw: '100000000003686269380',
    xno: '0.00000000010000000000368626938',
  },
  votingWeight: {
    raw: '2728264138501825291765595844657011341',
    xno: '2728264.138501825291765595844657011341',
  },
  oneRaw: {
    raw: '1',
    xno: '0.000000000000000000000000000001',
  },
} as const;

// Minimal NanoReaders that only implements accountInfo (the only method getNanoAccountInfo calls).
// All other methods throw to catch accidental usage.
function readersReturning(result: AccountInfoResponse | NanoRpcErrorResponse): NanoReaders {
  return {
    accountInfo: () => Promise.resolve(result),
    accountBalance: () => { throw new Error('unexpected call to accountBalance'); },
    receivable: () => { throw new Error('unexpected call to receivable'); },
    accountHistory: () => { throw new Error('unexpected call to accountHistory'); },
  };
}

const ctx = { config: {} as any };

describe('getNanoAccountInfo', () => {
  it('converts a typical balance correctly', async () => {
    const readers = readersReturning({
      frontier: 'AAAA'.repeat(16),
      representative: 'nano_1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1111',
      balance: VECTORS.smallBalance.raw,
      pending: '0',
      block_count: '8',
      weight: '0',
    });

    const info = await getNanoAccountInfo({ address: TEST_ADDRESS }, readers, ctx);
    expect(info.balanceRaw).toBe(VECTORS.smallBalance.raw);
    expect(info.balanceXno).toBe(VECTORS.smallBalance.xno);
    expect(info.pendingRaw).toBe('0');
    expect(info.pendingXno).toBe('0');
  });

  it('converts exactly 1 XNO correctly', async () => {
    const readers = readersReturning({
      frontier: 'BBBB'.repeat(16),
      representative: 'nano_1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1111',
      balance: VECTORS.oneXno.raw,
      pending: '0',
      block_count: '1',
      weight: '0',
    });

    const info = await getNanoAccountInfo({ address: TEST_ADDRESS }, readers, ctx);
    expect(info.balanceXno).toBe('1');
    expect(info.balanceRaw).toBe(VECTORS.oneXno.raw);
  });

  it('converts a large representative balance, dust pending, and voting weight', async () => {
    const readers = readersReturning({
      frontier: 'CCCC'.repeat(16),
      representative: 'nano_1anrzcuwe64rwxzcco8dkhpyxpi8kd7zsjc1oeimpc3ppca4mrjtwnqposrs',
      balance: VECTORS.repBalance.raw,
      pending: VECTORS.dustPending.raw,
      block_count: '109',
      weight: VECTORS.votingWeight.raw,
    });

    const info = await getNanoAccountInfo({ address: TEST_ADDRESS }, readers, ctx);

    expect(info.balanceRaw).toBe(VECTORS.repBalance.raw);
    expect(info.balanceXno).toBe(VECTORS.repBalance.xno);

    expect(info.pendingRaw).toBe(VECTORS.dustPending.raw);
    expect(info.pendingXno).toBe(VECTORS.dustPending.xno);

    expect(info.weightRaw).toBe(VECTORS.votingWeight.raw);
    expect(info.weightXno).toBe(VECTORS.votingWeight.xno);
  });

  it('converts exactly 1 raw correctly', async () => {
    const readers = readersReturning({
      frontier: 'DDDD'.repeat(16),
      representative: 'nano_1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1111',
      balance: VECTORS.oneRaw.raw,
      pending: '0',
      block_count: '1',
      weight: '0',
    });

    const info = await getNanoAccountInfo({ address: TEST_ADDRESS }, readers, ctx);
    expect(info.balanceXno).toBe(VECTORS.oneRaw.xno);
  });

  it('returns all expected fields for an open account', async () => {
    const readers = readersReturning({
      frontier: '26699A824362B6D19BBD1AF9501E517E30C59A996848C1643272ADC7EF277211',
      representative: 'nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4',
      balance: '1500000000000000000000000000000',
      pending: '500000000000000000000000000000',
      block_count: '10',
      weight: '1000000000000000000000000000000000',
    });

    const info = await getNanoAccountInfo({ address: TEST_ADDRESS }, readers, ctx);

    expect(info.address).toBe(TEST_ADDRESS);
    expect(info.balanceRaw).toBe('1500000000000000000000000000000');
    expect(info.balanceXno).toBe('1.5');
    expect(info.pendingRaw).toBe('500000000000000000000000000000');
    expect(info.pendingXno).toBe('0.5');
    expect(info.representative).toBe('nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4');
    expect(info.frontier).toBe('26699A824362B6D19BBD1AF9501E517E30C59A996848C1643272ADC7EF277211');
    expect(info.blockCount).toBe('10');
    expect(info.weightRaw).toBe('1000000000000000000000000000000000');
    expect(info.weightXno).toBe('1000');
  });

  it('returns zero balance for "Account not found" RPC error', async () => {
    const readers = readersReturning({ error: 'Account not found' } as NanoRpcErrorResponse);

    const info = await getNanoAccountInfo({ address: TEST_ADDRESS }, readers, ctx);

    expect(info.balanceRaw).toBe('0');
    expect(info.pendingRaw).toBe('0');
    expect(info.balanceXno).toBe('0');
    expect(info.pendingXno).toBe('0');
    expect(info.representative).toBeUndefined();
    expect(info.frontier).toBeUndefined();
    expect(info.blockCount).toBeUndefined();
  });

  it('rejects when neither wallet nor address is provided', async () => {
    const readers = readersReturning({ frontier: 'A'.repeat(64), balance: '0' } as any);
    await expect(getNanoAccountInfo({}, readers, ctx)).rejects.toThrow('Either wallet or address must be provided');
  });

  it('rejects invalid Nano addresses', async () => {
    const readers = readersReturning({ frontier: 'A'.repeat(64), balance: '0' } as any);
    await expect(getNanoAccountInfo({ address: 'not_a_valid_address' }, readers, ctx)).rejects.toThrow('Invalid address');
  });

  it('handles missing pending field gracefully', async () => {
    const readers = readersReturning({
      frontier: 'EEEE'.repeat(16),
      representative: 'nano_1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1111',
      balance: VECTORS.oneXno.raw,
      block_count: '5',
    } as any);

    const info = await getNanoAccountInfo({ address: TEST_ADDRESS }, readers, ctx);
    expect(info.pendingRaw).toBe('0');
    expect(info.pendingXno).toBe('0');
  });

  it('handles missing weight field gracefully', async () => {
    const readers = readersReturning({
      frontier: 'FFFF'.repeat(16),
      representative: 'nano_1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1rep1111',
      balance: VECTORS.oneXno.raw,
      pending: '0',
      block_count: '5',
    } as any);

    const info = await getNanoAccountInfo({ address: TEST_ADDRESS }, readers, ctx);
    expect(info.weightRaw).toBeUndefined();
    expect(info.weightXno).toBeUndefined();
  });
});

describe('rawToNano + nanoToRaw roundtrip for info vectors', () => {
  for (const [label, { raw, xno }] of Object.entries(VECTORS)) {
    it(`${label}: rawToNano('${raw}') === '${xno}'`, () => {
      expect(rawToNano(raw)).toBe(xno);
    });

    it(`${label}: nanoToRaw('${xno}') === '${raw}' (roundtrip)`, () => {
      expect(nanoToRaw(xno)).toBe(raw);
    });
  }
});
