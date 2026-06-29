import { validateAddress } from './validate.js';
import { NanoClient } from '@openrai/nano-core';
import { buildHeaders } from '@openrai/nano-core/transport/http';
import type { NormalizedEndpoint } from '@openrai/nano-core/transport';

export interface NanoRpcErrorResponse {
  error: string | number;
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
        const json: any = await res.json();
        if (json?.error != null && !options.allowRpcError) {
          throw new Error(`RPC error: ${String(json.error)}`);
        }
        return json;
      } finally {
        clearTimeout(timer);
      }
    });
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
  
  if ((res as any)?.error != null) {
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
  if ((res as any)?.error != null) {
    if (String((res as any).error).toLowerCase().includes('account not found')) return [];
    throw new Error(String((res as any).error));
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

export type ProbeCapStatus =
  | 'supported'
  | 'validation_error'
  | 'rpc_error'
  | 'permission_or_quota'
  | 'transport_error'
  | 'timeout';

export type ProbeCapResult = {
  ok: boolean;
  latencyMs: number;
  status: ProbeCapStatus;
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
    jsonRpc: ProbeCapResult;
    version: ProbeCapResult;
    blockCount: ProbeCapResult;
    processInvalid: ProbeCapResult;
    workGenerate: ProbeCapResult;
  };
  results?: RpcProbeResult[];
};

const RECEIVE_OPEN_DIFFICULTY = 'fffffe0000000000';
const ZERO_HASH = '0'.repeat(64);
const ZERO_ACCOUNT = 'nano_1111111111111111111111111111111111111111111111111111hifc8npp';

function initialCap(): ProbeCapResult {
  return { ok: false, latencyMs: 0, status: 'transport_error' };
}

function classifyFailure(error: unknown): Pick<ProbeCapResult, 'status' | 'detail'> {
  const detail = error instanceof Error ? error.message : String(error);
  const lower = detail.toLowerCase();
  if (lower.includes('abort') || lower.includes('timeout') || lower.includes('timed out')) {
    return { status: 'timeout', detail };
  }
  if (
    lower.includes('http error 401') ||
    lower.includes('http error 403') ||
    lower.includes('http error 429') ||
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('quota')
  ) {
    return { status: 'permission_or_quota', detail };
  }
  if (lower.includes('rpc error:')) {
    return { status: 'rpc_error', detail };
  }
  return { status: 'transport_error', detail };
}

function classifyRpcError(error: unknown): ProbeCapStatus {
  const lower = String(error).toLowerCase();
  if (
    lower.includes('unauthorized') ||
    lower.includes('forbidden') ||
    lower.includes('too many requests') ||
    lower.includes('rate limit') ||
    lower.includes('quota') ||
    lower.includes('permission') ||
    lower.includes('disabled')
  ) {
    return 'permission_or_quota';
  }
  return 'rpc_error';
}

function invalidStateBlock(): Record<string, string> {
  return {
    type: 'state',
    account: ZERO_ACCOUNT,
    previous: ZERO_HASH,
    representative: ZERO_ACCOUNT,
    balance: '0',
    link: ZERO_HASH,
    link_as_account: ZERO_ACCOUNT,
    signature: '0'.repeat(128),
    work: '0'.repeat(16),
  };
}

async function probeSingleRpcUrl(
  client: NanoClient,
  url: string,
  options: RpcCallOptions = {}
): Promise<RpcProbeResult> {
  const result: RpcProbeResult = {
    url,
    reachable: false,
    pingMs: 0,
    caps: {
      jsonRpc: initialCap(),
      version: initialCap(),
      blockCount: initialCap(),
      processInvalid: initialCap(),
      workGenerate: initialCap(),
    },
  };

  // 1. version — fail-fast JSON RPC probe and Nano node metadata.
  const vStart = Date.now();
  try {
    const v = await nanoRpcCall<VersionResponse>(client, { action: 'version' }, options);
    const vMs = Date.now() - vStart;
    result.caps.jsonRpc = { ok: true, latencyMs: vMs, status: 'supported' };
    result.caps.version = { ok: true, latencyMs: vMs, status: 'supported' };
    result.pingMs = vMs;
    result.reachable = true;
    result.nodeVendor = v.node_vendor;
    result.network = v.network;
    result.protocolVersion = v.protocol_version;
  } catch (e: any) {
    const failure = classifyFailure(e);
    const cap = { ok: false, latencyMs: Date.now() - vStart, ...failure };
    result.caps.jsonRpc = cap;
    result.caps.version = cap;
    return result;
  }

  // 2. block_count — basic ledger-read capability
  const bcStart = Date.now();
  try {
    const bc = await nanoRpcCall<BlockCountResponse>(client, { action: 'block_count' }, options);
    const bcMs = Date.now() - bcStart;
    result.caps.blockCount = { ok: true, latencyMs: bcMs, status: 'supported' };
    result.blockCount = bc.count;
    result.cementedCount = bc.cemented;
  } catch (e: any) {
    result.caps.blockCount = { ok: false, latencyMs: Date.now() - bcStart, ...classifyFailure(e) };
  }

  // 3. process — submit a syntactically valid but cryptographically invalid block.
  const piStart = Date.now();
  try {
    const pi = await nanoRpcCall<NanoRpcResponse<ProcessResponse>>(
      client,
      { action: 'process', json_block: 'true', subtype: 'open', block: invalidStateBlock() },
      { ...options, allowRpcError: true }
    );
    const piMs = Date.now() - piStart;
    if ((pi as any)?.error != null) {
      const detail = String((pi as any).error);
      const status = classifyRpcError(detail);
      result.caps.processInvalid = {
        ok: status !== 'permission_or_quota',
        latencyMs: piMs,
        status: status === 'permission_or_quota' ? status : 'validation_error',
        detail,
      };
    } else {
      result.caps.processInvalid = {
        ok: true,
        latencyMs: piMs,
        status: 'supported',
        detail: 'Unexpectedly accepted invalid block',
      };
    }
  } catch (e: any) {
    result.caps.processInvalid = { ok: false, latencyMs: Date.now() - piStart, ...classifyFailure(e) };
  }

  // 4. work_generate — remote PoW support at live receive/open difficulty.
  const wgStart = Date.now();
  try {
    const wg = await nanoRpcCall<NanoRpcResponse<{ work: string }>>(
      client,
      { action: 'work_generate', hash: ZERO_HASH, difficulty: RECEIVE_OPEN_DIFFICULTY },
      { ...options, allowRpcError: true }
    );
    const wgMs = Date.now() - wgStart;
    if ((wg as any)?.error != null) {
      const detail = String((wg as any).error);
      result.caps.workGenerate = {
        ok: false,
        latencyMs: wgMs,
        status: classifyRpcError(detail),
        detail,
      };
    } else if (typeof (wg as any).work === 'string' && /^[0-9a-fA-F]{16}$/.test((wg as any).work)) {
      result.caps.workGenerate = { ok: true, latencyMs: wgMs, status: 'supported' };
    } else {
      result.caps.workGenerate = {
        ok: false,
        latencyMs: wgMs,
        status: 'rpc_error',
        detail: 'work_generate response did not include 16 hex characters of work',
      };
    }
  } catch (e: any) {
    result.caps.workGenerate = { ok: false, latencyMs: Date.now() - wgStart, ...classifyFailure(e) };
  }

  return result;
}

export async function rpcProbeCaps(
  client: NanoClient,
  url: string,
  options: RpcCallOptions = {}
): Promise<RpcProbeResult> {
  const urls = url.split(',').map((value) => value.trim()).filter(Boolean);
  if (urls.length <= 1) return probeSingleRpcUrl(client, urls[0] ?? url, options);

  const results = await Promise.all(
    urls.map((rpcUrl) => probeSingleRpcUrl(NanoClient.initialize({ rpc: [rpcUrl] }), rpcUrl, options))
  );
  return {
    ...results[0],
    url,
    reachable: results.every((result) => result.reachable),
    pingMs: results.reduce((sum, result) => sum + result.pingMs, 0),
    results,
  };
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
    if ((res as any)?.error != null) {
      if (String((res as any).error).toLowerCase().includes('account not found')) return [];
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
    if ((res as any)?.error != null) {
      if (String((res as any).error).toLowerCase().includes('account not found')) return [];
      throw new Error(String((res as any).error));
    }
    const blocksForAccount = (res as any)?.blocks?.[address];
    return normalizeReceivableBlocks(blocksForAccount);
  }
}
