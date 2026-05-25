import { validateAddress } from './validate.js';
import { NanoClient } from '@openrai/nano-core';
import { buildHeaders } from '@openrai/nano-core/transport/http';
import type { NormalizedEndpoint } from '@openrai/nano-core/transport';

export interface NanoRpcErrorResponse {
  error: string;
}

export type NanoRpcResponse<T> = T | NanoRpcErrorResponse;

export interface AccountBalanceResponse {
  balance: string; // raw
  pending: string; // raw
}

export interface AccountsBalancesResponse {
  balances: Record<string, { balance: string; pending: string }>;
}

export interface AccountsFrontiersResponse {
  frontiers: Record<string, string>;
}

export interface RpcCallOptions {
  timeoutMs?: number;
  /**
   * When true, do not throw on JSON-RPC `"error"` payloads.
   * Useful for actions like `account_info` where "Account not found" is a normal state.
   */
  allowRpcError?: boolean;
}

export async function nanoRpcCall<T>(
  client: NanoClient,
  body: Record<string, unknown>,
  options: RpcCallOptions = {}
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 15_000;

  try {
    const json = await (client.rpcPool as any).pool.execute(async (endpoint: NormalizedEndpoint) => {
      const payload = endpoint.auth.type === 'api-key' && endpoint.auth.policy === 'json-body-key'
        ? { ...body, key: endpoint.auth.value }
        : endpoint.auth.type === 'api-key' && endpoint.auth.policy === 'bearer-and-json-body-key'
          ? { ...body, key: endpoint.auth.value }
          : body;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: buildHeaders(endpoint),
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status} ${res.statusText}`);
        }
        return res.json();
      } finally {
        clearTimeout(timer);
      }
    });

    if (typeof json?.error === 'string') {
      if (options.allowRpcError) {
        return json as T;
      }
      throw new Error(`RPC error: ${json.error}`);
    }
    return json as T;
  } catch (e: any) {
    if (options.allowRpcError) {
      const msg = (e.message || String(e)).toLowerCase();
      if (msg.includes('account not found') || msg.includes('404')) {
        return { error: 'Account not found' } as unknown as T;
      }
    }
    if (e.message?.includes('RPC error:')) throw e;
    throw new Error(`RPC request failed: ${e.message}`);
  }
}

export async function rpcAccountBalance(
  client: NanoClient,
  address: string,
  options: RpcCallOptions = {}
): Promise<AccountBalanceResponse> {
  const v = validateAddress(address);
  if (!v.valid) throw new Error(`Invalid address: ${v.error}`);

  const res = await nanoRpcCall<NanoRpcResponse<AccountBalanceResponse>>(
    client,
    { action: 'account_balance', account: address },
    { ...options, allowRpcError: true }
  );
  
  if (typeof (res as any)?.error === 'string') {
    return { balance: '0', pending: '0' };
  }
  return res as AccountBalanceResponse;
}

export interface AccountInfoResponse {
  frontier: string;
  representative?: string;
  balance: string;
  pending?: string;
  block_count?: string;
  weight?: string;
}

export async function rpcAccountInfo(
  client: NanoClient,
  address: string,
  options: RpcCallOptions = {}
): Promise<NanoRpcResponse<AccountInfoResponse>> {
  const v = validateAddress(address);
  if (!v.valid) throw new Error(`Invalid address: ${v.error}`);

  return nanoRpcCall<NanoRpcResponse<AccountInfoResponse>>(
    client,
    { action: 'account_info', account: address, representative: 'true', pending: 'true', weight: 'true' },
    { ...options, allowRpcError: true }
  );
}

export async function rpcAccountsBalances(
  client: NanoClient,
  addresses: string[],
  options: RpcCallOptions = {}
): Promise<AccountsBalancesResponse> {
  if (!Array.isArray(addresses) || addresses.length === 0) throw new Error('At least one address is required');
  for (const a of addresses) {
    const v = validateAddress(a);
    if (!v.valid) throw new Error(`Invalid address: ${a} (${v.error})`);
  }
  return nanoRpcCall<AccountsBalancesResponse>(
    client,
    { action: 'accounts_balances', accounts: addresses },
    options
  );
}

export async function rpcAccountsFrontiers(
  client: NanoClient,
  addresses: string[],
  options: RpcCallOptions = {}
): Promise<AccountsFrontiersResponse> {
  if (!Array.isArray(addresses) || addresses.length === 0) throw new Error('At least one address is required');
  for (const a of addresses) {
    const v = validateAddress(a);
    if (!v.valid) throw new Error(`Invalid address: ${a} (${v.error})`);
  }
  return nanoRpcCall<AccountsFrontiersResponse>(
    client,
    { action: 'accounts_frontiers', accounts: addresses },
    options
  );
}

export interface ProcessResponse {
  hash: string;
}

export async function rpcProcess(
  client: NanoClient,
  block: Record<string, unknown>,
  subtype: 'send' | 'receive' | 'open' | 'change',
  options: RpcCallOptions = {}
): Promise<ProcessResponse> {
  return nanoRpcCall<ProcessResponse>(
    client,
    { action: 'process', json_block: 'true', subtype, block },
    options
  );
}

export interface ReceivableItem {
  hash: string;
  amount: string; // raw
  source?: string; // address
}

type ReceivableResponse = {
  blocks: Record<string, { amount: string; source?: string }>;
};

type AccountsPendingResponse = {
  blocks: Record<string, Record<string, { amount: string; source?: string } | string>>;
};

function normalizeReceivableBlocks(blocks: any): ReceivableItem[] {
  if (!blocks || typeof blocks !== 'object') return [];
  const out: ReceivableItem[] = [];
  for (const [hash, v] of Object.entries(blocks)) {
    if (typeof hash !== 'string') continue;
    if (typeof v === 'string') out.push({ hash, amount: v });
    else if (v && typeof v === 'object' && typeof (v as any).amount === 'string') {
      out.push({ hash, amount: (v as any).amount, source: typeof (v as any).source === 'string' ? (v as any).source : undefined });
    }
  }
  return out;
}

export interface AccountHistoryEntry {
  type: string;
  account: string;
  amount: string;
  local_timestamp: string;
  height: string;
  hash: string;
  confirmed: string;
}

export async function rpcAccountHistory(
  client: NanoClient,
  address: string,
  count: number,
  options: RpcCallOptions = {}
): Promise<AccountHistoryEntry[]> {
  const v = validateAddress(address);
  if (!v.valid) throw new Error(`Invalid address: ${v.error}`);
  const n = Math.max(1, Math.min(1000, Math.floor(count || 10)));

  const res = await nanoRpcCall<any>(
    client,
    { action: 'account_history', account: address, count: String(n) },
    { ...options, allowRpcError: true }
  );
  if (typeof res?.error === 'string') {
    if (res.error.toLowerCase().includes('account not found')) return [];
    throw new Error(res.error);
  }
  return res.history || [];
}

interface VersionResponse {
  rpc_version: string;
  store_version: string;
  protocol_version: string;
  node_vendor: string;
  store_vendor?: string;
  network?: string;
  network_identifier?: string;
  build_info?: string;
}

interface BlockCountResponse {
  count: string;
  unchecked: string;
  cemented?: string;
}

export type ProbeCapResult = {
  ok: boolean;
  latencyMs: number;
  detail?: string;
};

export type RpcProbeResult = {
  url: string;
  reachable: boolean;
  pingMs: number;
  nodeVendor?: string;
  network?: string;
  protocolVersion?: string;
  blockCount?: string;
  cementedCount?: string;
  caps: {
    version: ProbeCapResult;
    blockCount: ProbeCapResult;
    workGenerate: ProbeCapResult;
  };
};

export async function rpcProbeCaps(
  client: NanoClient,
  url: string,
  options: RpcCallOptions = {}
): Promise<RpcProbeResult> {
  const result: RpcProbeResult = {
    url,
    reachable: false,
    pingMs: 0,
    caps: {
      version: { ok: false, latencyMs: 0 },
      blockCount: { ok: false, latencyMs: 0 },
      workGenerate: { ok: false, latencyMs: 0 },
    },
  };

  // 1. version — proves it is a Nano RPC and gives node info + ping
  const vStart = Date.now();
  try {
    const v = await nanoRpcCall<VersionResponse>(client, { action: 'version' }, options);
    const vMs = Date.now() - vStart;
    result.caps.version = { ok: true, latencyMs: vMs };
    result.pingMs = vMs;
    result.reachable = true;
    result.nodeVendor = v.node_vendor;
    result.network = v.network;
    result.protocolVersion = v.protocol_version;
  } catch (e: any) {
    result.caps.version = { ok: false, latencyMs: Date.now() - vStart, detail: e.message };
    return result;
  }

  // 2. block_count — basic ledger-read capability
  const bcStart = Date.now();
  try {
    const bc = await nanoRpcCall<BlockCountResponse>(client, { action: 'block_count' }, options);
    const bcMs = Date.now() - bcStart;
    result.caps.blockCount = { ok: true, latencyMs: bcMs };
    result.blockCount = bc.count;
    result.cementedCount = bc.cemented;
  } catch (e: any) {
    result.caps.blockCount = { ok: false, latencyMs: Date.now() - bcStart, detail: e.message };
  }

  // 3. work_generate — remote PoW support
  const wgStart = Date.now();
  try {
    const wg = await nanoRpcCall<{ work: string }>(
      client,
      { action: 'work_generate', hash: '0'.repeat(64), difficulty: 'Dev' },
      options
    );
    const wgMs = Date.now() - wgStart;
    result.caps.workGenerate = { ok: true, latencyMs: wgMs };
  } catch (e: any) {
    result.caps.workGenerate = { ok: false, latencyMs: Date.now() - wgStart, detail: e.message };
  }

  return result;
}

export async function rpcReceivable(
  client: NanoClient,
  address: string,
  count: number,
  options: RpcCallOptions = {}
): Promise<ReceivableItem[]> {
  const v = validateAddress(address);
  if (!v.valid) throw new Error(`Invalid address: ${v.error}`);
  const n = Math.max(1, Math.min(1000, Math.floor(count || 10)));

  // Prefer modern action `receivable`; fall back to `accounts_pending` for older nodes.
  try {
    const res = await nanoRpcCall<NanoRpcResponse<ReceivableResponse>>(
      client,
      { action: 'receivable', account: address, count: String(n), source: 'true' },
      { ...options, allowRpcError: true }
    );
    if (typeof (res as any)?.error === 'string') {
      if ((res as any).error.toLowerCase().includes('account not found')) return [];
      throw new Error(String((res as any).error));
    }
    return normalizeReceivableBlocks((res as any).blocks);
  } catch (e: any) {
    if (e.message?.toLowerCase().includes('account not found')) return [];

    const res = await nanoRpcCall<NanoRpcResponse<AccountsPendingResponse>>(
      client,
      { action: 'accounts_pending', accounts: [address], count: String(n), source: 'true' },
      { ...options, allowRpcError: true }
    );
    if (typeof (res as any)?.error === 'string') {
      if ((res as any).error.toLowerCase().includes('account not found')) return [];
      throw new Error(String((res as any).error));
    }
    const blocksForAccount = (res as any)?.blocks?.[address];
    return normalizeReceivableBlocks(blocksForAccount);
  }
}
