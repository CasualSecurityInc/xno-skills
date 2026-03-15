import { validateAddress } from './validate.js';

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
  rpcUrl: string,
  body: Record<string, unknown>,
  options: RpcCallOptions = {}
): Promise<T> {
  if (!rpcUrl) throw new Error('RPC URL is required');

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`RPC returned non-JSON response (status ${res.status})`);
    }

    if (!res.ok) {
      const msg = typeof json?.error === 'string' ? json.error : `HTTP ${res.status}`;
      throw new Error(`RPC error: ${msg}`);
    }

    if (typeof json?.error === 'string') {
      if (options.allowRpcError) return json as T;
      throw new Error(`RPC error: ${json.error}`);
    }

    return json as T;
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`RPC request timed out after ${timeoutMs}ms`);
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function rpcAccountBalance(
  rpcUrl: string,
  address: string,
  options: RpcCallOptions = {}
): Promise<AccountBalanceResponse> {
  const v = validateAddress(address);
  if (!v.valid) throw new Error(`Invalid address: ${v.error}`);

  return nanoRpcCall<AccountBalanceResponse>(
    rpcUrl,
    { action: 'account_balance', account: address },
    options
  );
}

export interface AccountInfoResponse {
  frontier: string;
  representative?: string;
  balance: string;
}

export async function rpcAccountInfo(
  rpcUrl: string,
  address: string,
  options: RpcCallOptions = {}
): Promise<NanoRpcResponse<AccountInfoResponse>> {
  const v = validateAddress(address);
  if (!v.valid) throw new Error(`Invalid address: ${v.error}`);

  return nanoRpcCall<NanoRpcResponse<AccountInfoResponse>>(
    rpcUrl,
    { action: 'account_info', account: address, representative: 'true' },
    { ...options, allowRpcError: true }
  );
}

export async function rpcAccountsBalances(
  rpcUrl: string,
  addresses: string[],
  options: RpcCallOptions = {}
): Promise<AccountsBalancesResponse> {
  if (!Array.isArray(addresses) || addresses.length === 0) throw new Error('At least one address is required');
  for (const a of addresses) {
    const v = validateAddress(a);
    if (!v.valid) throw new Error(`Invalid address: ${a} (${v.error})`);
  }
  return nanoRpcCall<AccountsBalancesResponse>(
    rpcUrl,
    { action: 'accounts_balances', accounts: addresses },
    options
  );
}

export async function rpcAccountsFrontiers(
  rpcUrl: string,
  addresses: string[],
  options: RpcCallOptions = {}
): Promise<AccountsFrontiersResponse> {
  if (!Array.isArray(addresses) || addresses.length === 0) throw new Error('At least one address is required');
  for (const a of addresses) {
    const v = validateAddress(a);
    if (!v.valid) throw new Error(`Invalid address: ${a} (${v.error})`);
  }
  return nanoRpcCall<AccountsFrontiersResponse>(
    rpcUrl,
    { action: 'accounts_frontiers', accounts: addresses },
    options
  );
}

export interface WorkGenerateResponse {
  work: string;
}

export async function rpcWorkGenerate(
  rpcUrl: string,
  rootOrHash: string,
  options: RpcCallOptions = {}
): Promise<WorkGenerateResponse> {
  if (typeof rootOrHash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(rootOrHash)) {
    throw new Error('work root/hash must be 32-byte hex (64 hex characters)');
  }
  return nanoRpcCall<WorkGenerateResponse>(
    rpcUrl,
    { action: 'work_generate', hash: rootOrHash },
    options
  );
}

export interface ProcessResponse {
  hash: string;
}

export async function rpcProcess(
  rpcUrl: string,
  block: Record<string, unknown>,
  subtype: 'send' | 'receive' | 'open' | 'change',
  options: RpcCallOptions = {}
): Promise<ProcessResponse> {
  return nanoRpcCall<ProcessResponse>(
    rpcUrl,
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

export async function rpcReceivable(
  rpcUrl: string,
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
      rpcUrl,
      { action: 'receivable', account: address, count: String(n), source: 'true' },
      { ...options, allowRpcError: true }
    );
    if (typeof (res as any)?.error === 'string') throw new Error(String((res as any).error));
    return normalizeReceivableBlocks((res as any).blocks);
  } catch {
    const res = await nanoRpcCall<NanoRpcResponse<AccountsPendingResponse>>(
      rpcUrl,
      { action: 'accounts_pending', accounts: [address], count: String(n), source: 'true' },
      { ...options, allowRpcError: true }
    );
    if (typeof (res as any)?.error === 'string') throw new Error(String((res as any).error));
    const blocksForAccount = (res as any)?.blocks?.[address];
    return normalizeReceivableBlocks(blocksForAccount);
  }
}
