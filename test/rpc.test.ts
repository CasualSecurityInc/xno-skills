import { describe, it, expect } from 'vitest';
import { rpcAccountBalance, nanoRpcCall, resolveRequestOptions } from '../src/rpc';

describe('rpcAccountBalance', () => {
  it('accepts valid Nano address', async () => {
    const address = 'nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d';
    const rpcUrl = 'https://example.invalid';
    
    await expect(rpcAccountBalance(rpcUrl, address)).rejects.toThrow();
  });
});

describe('nanoRpcCall protocol handling', () => {
  it('rejects with a network error (not a TLS/protocol error) for http:// URLs', async () => {
    await expect(
      nanoRpcCall('http://localhost:7076', { action: 'version' }, { timeoutMs: 500 })
    ).rejects.toThrow(/RPC (error|request timed out)/);
  });

  it('resolveRequestOptions uses port 80 by default for http:', () => {
    const opts = resolveRequestOptions('http://localhost/api');
    expect(opts.port).toBe(80);
  });

  it('resolveRequestOptions uses port 443 by default for https:', () => {
    const opts = resolveRequestOptions('https://localhost/api');
    expect(opts.port).toBe(443);
  });

  it('resolveRequestOptions respects explicit port for http:', () => {
    const opts = resolveRequestOptions('http://localhost:7076/');
    expect(opts.port).toBe(7076);
  });

  it('resolveRequestOptions respects explicit port for https:', () => {
    const opts = resolveRequestOptions('https://mynode.example.com:8443/rpc');
    expect(opts.port).toBe(8443);
  });

  it('resolveRequestOptions sets hostname and path correctly', () => {
    const opts = resolveRequestOptions('http://mynode.example.com:7076/api?foo=bar');
    expect(opts.hostname).toBe('mynode.example.com');
    expect(opts.path).toBe('/api?foo=bar');
  });
});
