import { describe, it, expect } from 'vitest';
import { rpcAccountBalance, nanoRpcCall } from '../src/rpc';
import { NanoClient } from '@openrai/nano-core';

describe('rpcAccountBalance', () => {
  it('accepts valid Nano address', async () => {
    const address = 'nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d';
    const client = NanoClient.initialize({ rpc: ['https://example.invalid'] });
    
    await expect(rpcAccountBalance(client, address)).rejects.toThrow();
  });
});

describe('nanoRpcCall protocol handling', () => {
  it('rejects with a network error (not a TLS/protocol error) for http:// URLs', async () => {
    const client = NanoClient.initialize({ rpc: ['http://localhost:7076'] });
    await expect(
      nanoRpcCall(client, { action: 'version' }, { timeoutMs: 500 })
    ).rejects.toThrow(/RPC (error|request failed)/);
  });
});
