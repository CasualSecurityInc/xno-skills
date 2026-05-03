import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NanoReaders, NanoActionContext } from '../src/nano-actions.js';
import type { ReceivableItem, AccountInfoResponse, NanoRpcErrorResponse } from '../src/rpc.js';

vi.mock('../src/ows.js', () => ({
  getWalletProxy: vi.fn().mockResolvedValue({
    id: 'mock-wallet-a',
    name: 'A',
    createdAt: new Date().toISOString(),
    accounts: [{
      address: 'nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7',
      chainId: 'nano',
      derivationPath: "m/44'/165'/0'/0/0",
    }],
  }),
  signTransactionProxy: vi.fn().mockResolvedValue({ signature: '0'.repeat(128) }),
  listWalletsProxy: vi.fn().mockResolvedValue([]),
  signMessageProxy: vi.fn().mockResolvedValue({ signature: '0'.repeat(128) }),
  signAndSendProxy: vi.fn().mockResolvedValue({ txHash: '0'.repeat(64) }),
}));

const ZERO_HASH = '0'.repeat(64);

function makeMockReaders(opts: {
  accountInfo?: AccountInfoResponse | NanoRpcErrorResponse;
  receivable?: ReceivableItem[];
  processHashes?: string[];
} = {}): NanoReaders {
  const processHashes = opts.processHashes ?? ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64)];
  let processIdx = 0;
  return {
    accountInfo: vi.fn().mockResolvedValue(opts.accountInfo ?? { error: 'Account not found' }),
    accountBalance: vi.fn().mockResolvedValue({ balance: '0', pending: '0' }),
    receivable: vi.fn().mockResolvedValue(opts.receivable ?? []),
    accountHistory: vi.fn().mockResolvedValue([]),
    workGenerate: vi.fn().mockResolvedValue('0000000000000000'),
    process: vi.fn().mockImplementation(() => Promise.resolve({ hash: processHashes[processIdx++] || processHashes[processHashes.length - 1] })),
    powTimeoutMs: 60_000,
  };
}

function makeCtx(): NanoActionContext {
  return {
    config: {},
    appendTransaction: vi.fn(),
  };
}

describe('executeReceive', () => {
  it('should process a single pending block on an unopened account (open block)', async () => {
    const { executeReceive } = await import('../src/nano-actions.js');

    const pending: ReceivableItem[] = [
      { hash: '11'.repeat(32), amount: '1000000000000000000000000000000', source: 'nano_sender1' },
    ];
    const readers = makeMockReaders({ receivable: pending, processHashes: ['aa'.repeat(32)] });
    const ctx = makeCtx();

    const result = await executeReceive('A', undefined, ctx, readers, { index: 0 });

    expect(result.address).toBe('nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7');
    expect(result.received).toHaveLength(1);
    expect(result.received[0].amountRaw).toBe('1000000000000000000000000000000');
    expect(result.balanceRaw).toBe('1000000000000000000000000000000');
    expect(result.balanceXno).toBe('1');

    expect(readers.process).toHaveBeenCalledTimes(1);
    const call = (readers.process as any).mock.calls[0];
    expect(call[1]).toBe('open');
    expect(call[0].link).toBe('11'.repeat(32));
    expect(call[0].balance).toBe('1000000000000000000000000000000');
    expect(call[0].previous).toBe(ZERO_HASH);
  });

  it('should process multiple pending blocks on an unopened account (open + receives)', async () => {
    const { executeReceive } = await import('../src/nano-actions.js');

    const pending: ReceivableItem[] = [
      { hash: '11'.repeat(32), amount: '1000000000000000000000000000000', source: 'nano_sender1' },
      { hash: '22'.repeat(32), amount: '500000000000000000000000000000', source: 'nano_sender2' },
      { hash: '33'.repeat(32), amount: '250000000000000000000000000000', source: 'nano_sender3' },
    ];
    const readers = makeMockReaders({
      receivable: pending,
      processHashes: ['aa'.repeat(32), 'bb'.repeat(32), 'cc'.repeat(32)],
    });
    const ctx = makeCtx();

    const result = await executeReceive('A', undefined, ctx, readers, { index: 0 });

    expect(result.received).toHaveLength(3);
    expect(result.received[0].hash).toBe('aa'.repeat(32));
    expect(result.received[1].hash).toBe('bb'.repeat(32));
    expect(result.received[2].hash).toBe('cc'.repeat(32));
    expect(result.balanceRaw).toBe('1750000000000000000000000000000');
    expect(result.balanceXno).toBe('1.75');

    expect(readers.process).toHaveBeenCalledTimes(3);

    const calls = (readers.process as any).mock.calls;
    expect(calls[0][1]).toBe('open');
    expect(calls[0][0].link).toBe('11'.repeat(32));
    expect(calls[0][0].previous).toBe(ZERO_HASH);
    expect(calls[0][0].balance).toBe('1000000000000000000000000000000');

    expect(calls[1][1]).toBe('receive');
    expect(calls[1][0].link).toBe('22'.repeat(32));
    expect(calls[1][0].previous).toBe('aa'.repeat(32));
    expect(calls[1][0].balance).toBe('1500000000000000000000000000000');

    expect(calls[2][1]).toBe('receive');
    expect(calls[2][0].link).toBe('33'.repeat(32));
    expect(calls[2][0].previous).toBe('bb'.repeat(32));
    expect(calls[2][0].balance).toBe('1750000000000000000000000000000');
  });

  it('should process multiple pending blocks on an already-opened account', async () => {
    const { executeReceive } = await import('../src/nano-actions.js');

    const existingInfo: AccountInfoResponse = {
      frontier: 'dd'.repeat(32),
      representative: 'nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4',
      balance: '1000000000000000000000000000000',
      block_count: '5',
    };

    const pending: ReceivableItem[] = [
      { hash: '11'.repeat(32), amount: '500000000000000000000000000000', source: 'nano_sender1' },
      { hash: '22'.repeat(32), amount: '300000000000000000000000000000', source: 'nano_sender2' },
    ];
    const readers = makeMockReaders({
      accountInfo: existingInfo,
      receivable: pending,
      processHashes: ['aa'.repeat(32), 'bb'.repeat(32)],
    });
    const ctx = makeCtx();

    const result = await executeReceive('A', undefined, ctx, readers, { index: 0 });

    expect(result.received).toHaveLength(2);
    expect(result.balanceRaw).toBe('1800000000000000000000000000000');
    expect(result.balanceXno).toBe('1.8');

    const calls = (readers.process as any).mock.calls;
    expect(calls[0][1]).toBe('receive');
    expect(calls[0][0].link).toBe('11'.repeat(32));
    expect(calls[0][0].previous).toBe('dd'.repeat(32));
    expect(calls[0][0].balance).toBe('1500000000000000000000000000000');

    expect(calls[1][1]).toBe('receive');
    expect(calls[1][0].link).toBe('22'.repeat(32));
    expect(calls[1][0].previous).toBe('aa'.repeat(32));
    expect(calls[1][0].balance).toBe('1800000000000000000000000000000');
  });

  it('should return early when no pending blocks exist', async () => {
    const { executeReceive } = await import('../src/nano-actions.js');

    const readers = makeMockReaders({ receivable: [] });
    const ctx = makeCtx();

    const result = await executeReceive('A', undefined, ctx, readers, { index: 0 });

    expect(result.received).toHaveLength(0);
    expect(result.balanceRaw).toBe('0');
    expect(readers.process).not.toHaveBeenCalled();
  });

  it('should filter by onlyHash when provided', async () => {
    const { executeReceive } = await import('../src/nano-actions.js');

    const pending: ReceivableItem[] = [
      { hash: '11'.repeat(32), amount: '1000000000000000000000000000000', source: 'nano_sender1' },
      { hash: '22'.repeat(32), amount: '500000000000000000000000000000', source: 'nano_sender2' },
    ];
    const readers = makeMockReaders({
      receivable: pending,
      processHashes: ['aa'.repeat(32)],
    });
    const ctx = makeCtx();

    const result = await executeReceive('A', undefined, ctx, readers, {
      index: 0,
      onlyHash: '22'.repeat(32),
    });

    expect(result.received).toHaveLength(1);
    expect(result.received[0].amountRaw).toBe('500000000000000000000000000000');
    expect(readers.process).toHaveBeenCalledTimes(1);
    const call = (readers.process as any).mock.calls[0];
    expect(call[0].link).toBe('22'.repeat(32));
  });
});
