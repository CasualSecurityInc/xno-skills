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
