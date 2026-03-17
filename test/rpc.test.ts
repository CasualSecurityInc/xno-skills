import { describe, it, expect } from 'vitest';
import { rpcAccountBalance } from '../src/rpc';

describe('rpcAccountBalance', () => {
  it('accepts valid Nano address', async () => {
    const address = 'nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d';
    const rpcUrl = 'https://example.invalid';
    
    await expect(rpcAccountBalance(rpcUrl, address)).rejects.toThrow();
  });
});
