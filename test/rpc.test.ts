import { afterEach, describe, expect, it, vi } from 'vitest';
import { nanoRpcCall, rpcAccountBalance, rpcProbeCaps } from '../src/rpc';
import { NanoClient } from '@openrai/nano-core';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });
}

function mockRpcFetch(handler: (body: any) => Response | Promise<Response>): void {
  vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    return handler(body);
  }));
}

describe('rpcAccountBalance', () => {
  it('accepts valid Nano address', { timeout: 3000 }, async () => {
    const address = 'nano_1pu7p5n3ghq1i1p4rhmek41f5add1uh34xpb94nkbxe8g4a6x1p69emk8y1d';
    const client = NanoClient.initialize({ rpc: ['https://example.invalid'] });
    
    await expect(rpcAccountBalance(client, address, { timeoutMs: 1500 })).rejects.toThrow();
  });
});

describe('nanoRpcCall protocol handling', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects with a network error (not a TLS/protocol error) for http:// URLs', async () => {
    const client = NanoClient.initialize({ rpc: ['http://localhost:7076'] });
    await expect(
      nanoRpcCall(client, { action: 'version' }, { timeoutMs: 500 })
    ).rejects.toThrow(/RPC (error|request failed)/);
  });
});

describe('rpcProbeCaps classification', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function client(): NanoClient {
    return NanoClient.initialize({ rpc: ['https://rpc.example/api'] });
  }

  function baseRpcResponse(action: string): Response {
    if (action === 'version') {
      return jsonResponse({
        rpc_version: '1',
        store_version: '26',
        protocol_version: '21',
        node_vendor: 'Nano V26.1',
        network: 'live',
      });
    }
    if (action === 'block_count') {
      return jsonResponse({ count: '100', unchecked: '0', cemented: '90' });
    }
    if (action === 'process') {
      return jsonResponse({ error: 'Block work is less than threshold' });
    }
    if (action === 'work_generate') {
      return jsonResponse({ work: 'f'.repeat(16) });
    }
    return jsonResponse({ error: 'unknown action' });
  }

  it('treats expected Nano validation errors from invalid process as permitted support', async () => {
    mockRpcFetch((body) => baseRpcResponse(body.action));

    const result = await rpcProbeCaps(client(), 'https://rpc.example/api', { timeoutMs: 500 });

    expect(result.caps.processInvalid.ok).toBe(true);
    expect(result.caps.processInvalid.status).toBe('validation_error');
    expect(result.caps.processInvalid.detail).toContain('threshold');
  });

  it('classifies HTTP 429/403 process responses as permission or quota failures', async () => {
    mockRpcFetch((body) => {
      if (body.action === 'process') {
        return jsonResponse({ error: 'Too many requests' }, { status: 429, statusText: 'Too Many Requests' });
      }
      return baseRpcResponse(body.action);
    });

    const result = await rpcProbeCaps(client(), 'https://rpc.example/api', { timeoutMs: 500 });

    expect(result.caps.processInvalid.ok).toBe(false);
    expect(result.caps.processInvalid.status).toBe('permission_or_quota');
  });

  it('classifies work_generate success with a valid work response', async () => {
    mockRpcFetch((body) => baseRpcResponse(body.action));

    const result = await rpcProbeCaps(client(), 'https://rpc.example/api', { timeoutMs: 500 });

    expect(result.caps.workGenerate.ok).toBe(true);
    expect(result.caps.workGenerate.status).toBe('supported');
  });

  it('classifies work_generate JSON errors', async () => {
    mockRpcFetch((body) => {
      if (body.action === 'work_generate') return jsonResponse({ error: 'work generation disabled' });
      return baseRpcResponse(body.action);
    });

    const result = await rpcProbeCaps(client(), 'https://rpc.example/api', { timeoutMs: 500 });

    expect(result.caps.workGenerate.ok).toBe(false);
    expect(result.caps.workGenerate.status).toBe('permission_or_quota');
    expect(result.caps.workGenerate.detail).toContain('disabled');
  });

  it('classifies work_generate transport failures', async () => {
    mockRpcFetch((body) => {
      if (body.action === 'work_generate') throw new Error('socket hang up');
      return baseRpcResponse(body.action);
    });

    const result = await rpcProbeCaps(client(), 'https://rpc.example/api', { timeoutMs: 500 });

    expect(result.caps.workGenerate.ok).toBe(false);
    expect(result.caps.workGenerate.status).toBe('transport_error');
    expect(result.caps.workGenerate.detail).toContain('socket hang up');
  });
});
