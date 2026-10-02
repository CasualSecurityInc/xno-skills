import { describe, expect, it, vi } from 'vitest';
import type { NanoActionContext, NanoReaders } from '../src/nano-actions.js';
import type { AccountInfoResponse } from '../src/rpc.js';

const ACCOUNT = 'nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7';
const REP_A = 'nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4';
const REP_B = ACCOUNT;
const DESTINATION = 'nano_1natrium1o3z5519ifou7xii8crpxpk8y65qmkih8e8bpsjri651oza8imdd';
const XNO = 10n ** 30n;

vi.mock('../src/ows.js', () => ({
  getWalletProxy: vi.fn().mockResolvedValue({
    id: 'mock-wallet-a',
    name: 'A',
    createdAt: new Date().toISOString(),
    accounts: [
      {
        address: ACCOUNT,
        chainId: 'nano',
        derivationPath: "m/44'/165'/0'/0/0",
      },
    ],
  }),
  signTransactionProxy: vi.fn().mockResolvedValue({ signature: '0'.repeat(128) }),
  listWalletsProxy: vi.fn().mockResolvedValue([]),
  signMessageProxy: vi.fn().mockResolvedValue({ signature: '0'.repeat(128) }),
  signAndSendProxy: vi.fn().mockResolvedValue({ txHash: '0'.repeat(64) }),
}));

function info(frontierByte: string, balanceXno: bigint, representative: string): AccountInfoResponse {
  return {
    frontier: frontierByte.repeat(64),
    representative,
    balance: (balanceXno * XNO).toString(),
    block_count: '5',
  };
}

function readersWithFreshInfo(fresh: AccountInfoResponse): NanoReaders {
  const accountInfo = vi.fn().mockResolvedValueOnce(info('a', 2n, REP_A)).mockResolvedValueOnce(fresh);
  const process = vi.fn().mockRejectedValueOnce(new Error('Invalid previous'))
    .mockResolvedValueOnce({ hash: 'c'.repeat(64) });
  return {
    accountInfo,
    accountBalance: vi.fn().mockResolvedValue({ balance: '0', pending: '0' }),
    receivable: vi.fn().mockResolvedValue([]),
    accountHistory: vi.fn().mockResolvedValue([]),
    workGenerate: vi.fn().mockResolvedValue('0000000000000000'),
    process,
  };
}

function ctx(): NanoActionContext {
  return { config: { maxSendXno: '2' }, appendTransaction: vi.fn() };
}

describe('executeSend stale-account retry', () => {
  it('uses the refreshed representative instead of reverting account state', async () => {
    const { executeSend } = await import('../src/nano-actions.js');
    const readers = readersWithFreshInfo(info('b', 2n, REP_B));

    const result = await executeSend('A', undefined, ctx(), readers, DESTINATION, '1');

    expect(result.hash).toBe('c'.repeat(64));
    expect(readers.process).toHaveBeenCalledTimes(2);
    const retryBlock = (readers.process as any).mock.calls[1][0];
    expect(retryBlock.previous).toBe('b'.repeat(64));
    expect(retryBlock.representative).toBe(REP_B);
    expect(retryBlock.balance).toBe(XNO.toString());
  });

  it('rechecks the refreshed balance before signing the retry', async () => {
    const { executeSend } = await import('../src/nano-actions.js');
    const readers = readersWithFreshInfo(info('b', 0n, REP_B));

    await expect(executeSend('A', undefined, ctx(), readers, DESTINATION, '1')).rejects.toThrow(
      /Insufficient balance/i,
    );

    expect(readers.process).toHaveBeenCalledTimes(1);
    expect(readers.workGenerate).toHaveBeenCalledTimes(1);
  });
});
