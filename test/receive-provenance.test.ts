import { describe, expect, it, vi } from 'vitest';
import type { NanoActionContext, NanoReaders } from '../src/nano-actions.js';

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
}));

const SOURCE = 'nano_3arg3asgtigae3xckabaaewkx3bzsh7nwz7jkmjos79ihyaxwphhm6qgjps4';
const SEND_HASH = 'a'.repeat(64);
const RECEIVE_HASH = 'b'.repeat(64);

function readers(): NanoReaders {
  return {
    accountInfo: vi.fn().mockResolvedValue({ error: 'Account not found' }),
    accountBalance: vi.fn().mockResolvedValue({ balance: '0', pending: '0' }),
    receivable: vi.fn().mockResolvedValue([{ hash: SEND_HASH, amount: '100', source: SOURCE }]),
    accountHistory: vi.fn().mockResolvedValue([]),
    workGenerate: vi.fn().mockResolvedValue('f'.repeat(16)),
    process: vi.fn().mockResolvedValue({ hash: RECEIVE_HASH }),
  };
}

describe('executeReceive provenance', () => {
  it('returns the source send hash and source address with the receive result', async () => {
    const { executeReceive } = await import('../src/nano-actions.js');
    const ctx: NanoActionContext = {
      config: { defaultRepresentative: SOURCE },
      appendTransaction: vi.fn(),
    };
    const result = await executeReceive('A', undefined, ctx, readers(), { count: 1 });
    expect(result.received).toEqual([{
      hash: RECEIVE_HASH,
      sendHash: SEND_HASH,
      source: SOURCE,
      amountRaw: '100',
    }]);
  });
});
