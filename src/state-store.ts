import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Serialisable subset of WorkExecutionPlan from @openrai/nano-core.
 * Stored in pow-plan.json so the MCP server and CLI can restore a local-first
 * execution plan across restarts without re-running the full probe each time.
 */
export type CachedPowPlan = {
  /** 'probe' means local backends were evaluated; 'default' means remote-first fallback. */
  source: 'default' | 'probe';
  steps: Array<{ kind: 'remote' | 'webgpu' | 'webgl' | 'wasm' }>;
  disabledLocalBackends: string[];
  probeResults: Array<{
    kind: 'remote' | 'webgpu' | 'webgl' | 'wasm';
    available: boolean;
    durationMs?: number;
    reason?: string;
  }>;
  /** ISO timestamp of when this plan was cached. */
  cachedAt: string;
};

export type XnoConfig = {
  rpcUrl?: string;
  workPeerUrl?: string;
  timeoutMs?: number;
  powTimeoutMs?: number;
  defaultRepresentative?: string;
  useWorkPeer?: boolean;
  maxSendXno?: string;
};

export type PaymentRequestStatus = 'pending' | 'partial' | 'funded' | 'received' | 'refunded' | 'cancelled';

export type PaymentRequest = {
  id: string;
  owsWalletId: string;
  accountIndex: number;
  address: string;
  amountRaw: string;
  reason: string;
  status: PaymentRequestStatus;
  createdAt: string;
  updatedAt: string;
  receivedBlocks: { sendHash: string; source: string; amountRaw: string; receiveHash?: string }[];
};

export type TransactionRecord = {
  id: string;
  owsWalletId: string;
  accountIndex: number;
  address: string;
  type: 'send' | 'receive' | 'change';
  amountRaw: string;
  counterparty: string;
  hash: string;
  paymentRequestId?: string;
  timestamp: string;
};

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/**
 * User-scoped cache directory for xno-mcp.
 *
 * Follows platform conventions:
 *   Linux  — $XDG_CACHE_HOME/xno-mcp   (fallback: ~/.cache/xno-mcp)
 *   macOS  — ~/Library/Caches/xno-mcp
 *   other  — ~/.cache/xno-mcp
 *
 * Override with $XNO_MCP_CACHE_DIR.
 */
function getCacheDir(): string {
  const envOverride = process.env.XNO_MCP_CACHE_DIR;
  if (envOverride && envOverride.trim()) return path.resolve(envOverride);

  const home = process.env.HOME || process.env.USERPROFILE || '';

  if (process.platform === 'darwin') {
    return path.join(home, 'Library', 'Caches', 'xno-mcp');
  }

  // Linux / other POSIX: prefer XDG_CACHE_HOME
  const xdgCache = process.env.XDG_CACHE_HOME;
  if (xdgCache && xdgCache.trim()) return path.join(xdgCache, 'xno-mcp');
  return path.join(home, '.cache', 'xno-mcp');
}

function getInstalledDir(): string {
  const url = typeof import.meta?.url === 'string' ? import.meta.url : null;
  if (url) return path.dirname(fileURLToPath(url));
  return __dirname;
}

function getHomeDir(): string {
  const envHome = process.env.XNO_MCP_HOME;
  if (envHome && envHome.trim()) return path.resolve(envHome);
  return path.join(getInstalledDir(), '.xno-mcp');
}

function getConfigPath(): string {
  const envPath = process.env.XNO_MCP_CONFIG_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), 'config.json');
}

function getPaymentRequestsPath(): string {
  const envPath = process.env.XNO_MCP_REQUESTS_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), 'requests.json');
}

function getTransactionsPath(): string {
  const envPath = process.env.XNO_MCP_TRANSACTIONS_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), 'transactions.json');
}

function loadJsonFile<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function saveJsonFile(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
}

export function loadConfig(): XnoConfig {
  return loadJsonFile<XnoConfig>(getConfigPath()) ?? {};
}

export function saveConfig(config: XnoConfig): void {
  saveJsonFile(getConfigPath(), config);
}

export function loadPaymentRequests(): Map<string, PaymentRequest> {
  const map = new Map<string, PaymentRequest>();
  const persisted = loadJsonFile<{ requests: PaymentRequest[] }>(getPaymentRequestsPath());
  if (persisted?.requests?.length) {
    for (const request of persisted.requests) map.set(request.id, request);
  }
  return map;
}

export function savePaymentRequests(requests: Iterable<PaymentRequest>): void {
  saveJsonFile(getPaymentRequestsPath(), { requests: Array.from(requests) });
}

export function loadTransactions(): TransactionRecord[] {
  const persisted = loadJsonFile<{ transactions: TransactionRecord[] }>(getTransactionsPath());
  return persisted?.transactions ?? [];
}

export function saveTransactions(transactions: TransactionRecord[]): void {
  saveJsonFile(getTransactionsPath(), { transactions });
}

// ---------------------------------------------------------------------------
// PoW execution plan cache
// ---------------------------------------------------------------------------

/** Maximum age of a cached PoW plan before it is considered stale (7 days). */
const POW_PLAN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getPowPlanPath(): string {
  return path.join(getCacheDir(), 'pow-plan.json');
}

/**
 * Load a previously cached PoW execution plan.
 * Returns null if the cache is missing, unreadable, or older than POW_PLAN_MAX_AGE_MS.
 */
export function loadPowPlan(): CachedPowPlan | null {
  const cached = loadJsonFile<CachedPowPlan>(getPowPlanPath());
  if (!cached?.cachedAt || cached.source !== 'probe') return null;
  const age = Date.now() - new Date(cached.cachedAt).getTime();
  if (age > POW_PLAN_MAX_AGE_MS) return null;
  return cached;
}

/**
 * Persist a PoW execution plan to disk.
 * Only plans with source='probe' are worth caching (default = remote-first, not useful).
 */
export function savePowPlan(plan: Omit<CachedPowPlan, 'cachedAt'>): void {
  if (plan.source !== 'probe') return;
  saveJsonFile(getPowPlanPath(), { ...plan, cachedAt: new Date().toISOString() });
}

/** Remove the cached PoW plan (e.g. after a config change that may affect local backends). */
export function clearPowPlan(): void {
  try { fs.unlinkSync(getPowPlanPath()); } catch { /* no-op if missing */ }
}
