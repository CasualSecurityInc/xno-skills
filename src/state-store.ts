import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type XnoConfig = {
  rpcUrl?: string;
  workPeerUrl?: string;
  timeoutMs?: number;
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

function getInstalledDir(): string {
  const url = typeof import.meta?.url === 'string' ? import.meta.url : null;
  if (url) return path.dirname(fileURLToPath(url));
  return __dirname;
}

export function getHomeDir(): string {
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
