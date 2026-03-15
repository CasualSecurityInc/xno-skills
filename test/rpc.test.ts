import { describe, it, expect } from 'vitest';
import { rpcAccountBalance } from '../src/rpc';

describe('rpcAccountBalance', () => {
  it('calls account_balance with account param', async () => {
    const address = 'nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d';
    const rpcUrl = 'http://example.invalid';

    const originalFetch = globalThis.fetch;
    (globalThis as any).fetch = async (url: any, init: any) => {
      expect(url).toBe(rpcUrl);
      expect(init.method).toBe('POST');
      expect(init.headers['content-type']).toBe('application/json');
      const body = JSON.parse(init.body);
      expect(body).toEqual({ action: 'account_balance', account: address });
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ balance: '10', pending: '2' }),
      } as any;
    };

    try {
      const result = await rpcAccountBalance(rpcUrl, address, { timeoutMs: 2000 });
      expect(result).toEqual({ balance: '10', pending: '2' });
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });
});
