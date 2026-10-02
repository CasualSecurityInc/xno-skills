import { describe, it, expect, vi } from 'vitest';
import type { NanoReaders, NanoActionContext } from '../src/nano-actions.js';

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

function makeReaders(): NanoReaders {
  return {
    accountInfo: vi.fn(),
    accountBalance: vi.fn(),
    receivable: vi.fn(),
    accountHistory: vi.fn(),
    workGenerate: vi.fn(),
    process: vi.fn(),
  };
}

describe('executeSend', () => {
  it('rejects zero XNO before any account RPC or block work', async () => {
    const { executeSend } = await import('../src/nano-actions.js');
    const readers = makeReaders();
    const ctx: NanoActionContext = { config: {}, appendTransaction: vi.fn() };

    await expect(executeSend(
      'A',
      undefined,
      ctx,
      readers,
      'nano_3i1aq1cchnmbn9x5rsbap8b15akfh7wj7pwskuzi7ahz8oq6cobd99d4r3b7',
      '0',
    )).rejects.toThrow('Amount must be greater than 0 XNO.');

    expect(readers.accountInfo).not.toHaveBeenCalled();
    expect(readers.workGenerate).not.toHaveBeenCalled();
    expect(readers.process).not.toHaveBeenCalled();
  });
});
