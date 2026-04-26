import { validateAddress } from './validate.js';
import { NanoClient } from '@openrai/nano-core';

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
    const json = await client.rpcPool.postJson<any>(body);
    if (typeof json?.error === 'string') {
      if (options.allowRpcError) {
        return json as T;
      }
      throw new Error(`RPC error: ${json.error}`);
    }
    return json as T;
  } catch (e: any) {
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

  return nanoRpcCall<AccountBalanceResponse>(
    client,
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
  client: NanoClient,
  address: string,
  options: RpcCallOptions = {}
): Promise<NanoRpcResponse<AccountInfoResponse>> {
  const v = validateAddress(address);
  if (!v.valid) throw new Error(`Invalid address: ${v.error}`);

  return nanoRpcCall<NanoRpcResponse<AccountInfoResponse>>(
    client,
    { action: 'account_info', account: address, representative: 'true' },
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

export interface WorkGenerateResponse {
  work: string;
}

export async function rpcWorkGenerate(
  client: NanoClient,
  rootOrHash: string,
  options: RpcCallOptions = {}
): Promise<WorkGenerateResponse> {
  if (typeof rootOrHash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(rootOrHash)) {
    throw new Error('work root/hash must be 32-byte hex (64 hex characters)');
  }
  return nanoRpcCall<WorkGenerateResponse>(
    client,
    { action: 'work_generate', hash: rootOrHash },
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
    if (typeof (res as any)?.error === 'string') throw new Error(String((res as any).error));
    return normalizeReceivableBlocks((res as any).blocks);
  } catch {
    const res = await nanoRpcCall<NanoRpcResponse<AccountsPendingResponse>>(
      client,
      { action: 'accounts_pending', accounts: [address], count: String(n), source: 'true' },
      { ...options, allowRpcError: true }
    );
    if (typeof (res as any)?.error === 'string') throw new Error(String((res as any).error));
    const blocksForAccount = (res as any)?.blocks?.[address];
    return normalizeReceivableBlocks(blocksForAccount);
  }
}
