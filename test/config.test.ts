import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveEffectiveRpcUrls, resolveEffectiveWorkUrls, DEFAULT_RPC_URLS } from '../src/config.js';
import type { XnoConfig } from '../src/state-store.js';

const ENV_KEYS = ['NANO_RPC_URL', 'NANO_WORK_URL'];

function clearEnv() {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe('resolveEffectiveRpcUrls', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it('falls back to DEFAULT_RPC_URLS when nothing is set', () => {
    expect(resolveEffectiveRpcUrls()).toEqual(DEFAULT_RPC_URLS);
  });

  it('uses the public RPC defaults in preferred order', () => {
    expect(DEFAULT_RPC_URLS).toEqual([
      'https://rainstorm.city/api',
      'https://nanoslo.0x.no/proxy',
      'https://rpc.nano.to',
    ]);
  });

  it('splits explicit comma-separated string', () => {
    const result = resolveEffectiveRpcUrls('https://a.example/api,https://b.example/api');
    expect(result).toEqual(['https://a.example/api', 'https://b.example/api']);
  });

  it('filters empty entries from explicit string', () => {
    const result = resolveEffectiveRpcUrls(',https://a.example/api,,https://b.example/api,');
    expect(result).toEqual(['https://a.example/api', 'https://b.example/api']);
  });

  it('reads saved config rpcUrl', () => {
    const config: XnoConfig = { rpcUrl: 'https://cfg.example/api,https://cfg2.example/api' };
    expect(resolveEffectiveRpcUrls(undefined, config)).toEqual([
      'https://cfg.example/api',
      'https://cfg2.example/api',
    ]);
  });

  it('prefers NANO_RPC_URL env var over saved config', () => {
    process.env.NANO_RPC_URL = 'https://env.example/api,https://env2.example/api';
    const config: XnoConfig = { rpcUrl: 'https://cfg.example/api' };
    expect(resolveEffectiveRpcUrls(undefined, config)).toEqual([
      'https://env.example/api',
      'https://env2.example/api',
    ]);
  });

  it('prefers explicit argument over env var and config', () => {
    process.env.NANO_RPC_URL = 'https://env.example/api';
    const config: XnoConfig = { rpcUrl: 'https://cfg.example/api' };
    expect(resolveEffectiveRpcUrls('https://explicit.example/api', config)).toEqual([
      'https://explicit.example/api',
    ]);
  });

  it('returns single element when given uncomma separated explicit string', () => {
    expect(resolveEffectiveRpcUrls('https://single.example/api')).toEqual([
      'https://single.example/api',
    ]);
  });
});

describe('resolveEffectiveWorkUrls', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it('falls back to DEFAULT_RPC_URLS when nothing is set', () => {
    expect(resolveEffectiveWorkUrls({})).toEqual(DEFAULT_RPC_URLS);
  });

  it('reads saved config workUrl', () => {
    const config: XnoConfig = { workUrl: 'https://work.example/api,https://work2.example/api' };
    expect(resolveEffectiveWorkUrls(config)).toEqual([
      'https://work.example/api',
      'https://work2.example/api',
    ]);
  });

  it('prefers NANO_WORK_URL env var over saved config workUrl', () => {
    process.env.NANO_WORK_URL = 'https://env-work.example/api,https://env-work2.example/api';
    const config: XnoConfig = { workUrl: 'https://cfg-work.example/api' };
    expect(resolveEffectiveWorkUrls(config)).toEqual([
      'https://env-work.example/api',
      'https://env-work2.example/api',
    ]);
  });

  it('falls back through rpcUrl chain when workUrl is unset', () => {
    process.env.NANO_RPC_URL = 'https://rpc-env.example/api';
    expect(resolveEffectiveWorkUrls({})).toEqual(['https://rpc-env.example/api']);
  });

  it('prefers NANO_WORK_URL over NANO_RPC_URL when both set', () => {
    process.env.NANO_WORK_URL = 'https://work.example/api';
    process.env.NANO_RPC_URL = 'https://rpc.example/api';
    expect(resolveEffectiveWorkUrls({})).toEqual(['https://work.example/api']);
  });

  it('filters empty entries from comma-separated env var', () => {
    process.env.NANO_WORK_URL = ',https://a.example/api,,https://b.example/api,';
    expect(resolveEffectiveWorkUrls({})).toEqual([
      'https://a.example/api',
      'https://b.example/api',
    ]);
  });
});

describe('env var overrides take priority over disk config', () => {
  beforeEach(clearEnv);
  afterEach(clearEnv);

  it('NANO_RPC_URL beats config.rpcUrl for RPC resolution', () => {
    process.env.NANO_RPC_URL = 'https://env.example/api';
    const config: XnoConfig = { rpcUrl: 'https://disk.example/api' };
    expect(resolveEffectiveRpcUrls(undefined, config)).toEqual([
      'https://env.example/api',
    ]);
  });

  it('NANO_WORK_URL beats config.workUrl for work resolution', () => {
    process.env.NANO_WORK_URL = 'https://env-work.example/api';
    const config: XnoConfig = { workUrl: 'https://disk-work.example/api' };
    expect(resolveEffectiveWorkUrls(config)).toEqual([
      'https://env-work.example/api',
    ]);
  });

  it('config.workUrl is used when no env var is set', () => {
    const config: XnoConfig = { workUrl: 'https://disk-work.example/api' };
    expect(resolveEffectiveWorkUrls(config)).toEqual(['https://disk-work.example/api']);
  });
});

describe('requireFreshConfig reload behaviour', () => {
  beforeEach(() => {
    clearEnv();
    vi.resetModules();
  });
  afterEach(clearEnv);

  it('re-reads config from disk when rpcUrl changes', async () => {
    const { loadConfig, saveConfig } = await import('../src/state-store.js');

    const mockLoad = vi.fn();
    let callCount = 0;
    mockLoad.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return { rpcUrl: 'https://first.example/api' } as XnoConfig;
      return { rpcUrl: 'https://second.example/api' } as XnoConfig;
    });

    vi.doMock('../src/state-store.js', () => ({
      loadConfig: mockLoad,
      saveConfig: vi.fn(),
      loadPaymentRequests: vi.fn(() => new Map()),
      loadTransactions: vi.fn(() => []),
    }));

    const { resolveEffectiveRpcUrls } = await import('../src/config.js');

    const fresh1 = resolveEffectiveRpcUrls(undefined, mockLoad());
    expect(fresh1).toEqual(['https://first.example/api']);

    const fresh2 = resolveEffectiveRpcUrls(undefined, mockLoad());
    expect(fresh2).toEqual(['https://second.example/api']);

    expect(mockLoad).toHaveBeenCalledTimes(2);
    expect(fresh1).not.toEqual(fresh2);
  });
});
