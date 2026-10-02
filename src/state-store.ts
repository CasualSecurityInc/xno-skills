import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export type XnoConfig = {
  rpcUrl?: string;
  workUrl?: string;
  timeoutMs?: number;
  powTimeoutMs?: number;
  defaultRepresentative?: string;
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
  receivedBlocks: { sendHash: string; source?: string; amountRaw: string; receiveHash?: string }[];
  refundedBlocks?: { source: string; amountRaw: string; sendHash: string; timestamp: string }[];
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
  return randomUUID();
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

/**
 * Collections are stored as one file per record under $XNO_MCP_HOME, so that
 * several stdio MCP server instances (or a CLI process alongside one) never
 * write the same file. Nothing is cached in process: every read hits the disk,
 * and every write is a whole-file rename, which is atomic on POSIX.
 */
function getPaymentsDir(): string {
  const envPath = process.env.XNO_MCP_REQUESTS_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), 'payments');
}

function getTransactionsDir(): string {
  const envPath = process.env.XNO_MCP_TRANSACTIONS_PATH;
  if (envPath && envPath.trim()) return path.resolve(envPath);
  return path.join(getHomeDir(), 'transactions');
}

/** Pre-per-record layout, imported once so existing installs keep their history. */
function getLegacyPaymentsPath(): string {
  return path.join(getHomeDir(), 'requests.json');
}

function getLegacyTransactionsPath(): string {
  return path.join(getHomeDir(), 'transactions.json');
}

function isMissing(filePath: string): boolean {
  return !fs.existsSync(filePath);
}

/**
 * Returns null only when the file is absent. A file that exists but cannot be
 * parsed is an error: reporting it as "no data" is how a truncated write turns
 * into silent, permanent loss.
 */
function readJsonFile<T>(filePath: string): T | null {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  return JSON.parse(raw) as T;
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Write via a temporary file in the same directory and rename into place.
 * rename(2) is atomic within a filesystem, so a reader never observes a
 * half-written record and a crash mid-write leaves the previous version intact.
 */
function writeFileAtomic(filePath: string, contents: string): void {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    fs.writeFileSync(tmp, contents, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmp, filePath);
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
    throw error;
  }
}

function saveJsonFile(filePath: string, value: unknown): void {
  writeFileAtomic(filePath, JSON.stringify(value, null, 2));
}

function readRecordDir<T extends { id: string }>(dir: string): T[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const records: T[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const filePath = path.join(dir, entry.name);
    try {
      const record = readJsonFile<T>(filePath);
      if (record) records.push(record);
    } catch (error) {
      // stderr, not stdout: stdout carries the MCP protocol on a stdio server.
      console.error(`[state-store] skipping unreadable record ${filePath}: ${(error as Error).message}`);
    }
  }
  return records;
}

function writeRecord<T extends { id: string }>(dir: string, record: T): void {
  // Guard against an id containing a path separator or traversal.
  if (!/^[A-Za-z0-9._-]+$/.test(record.id)) throw new Error(`Invalid record id: ${record.id}`);
  writeFileAtomic(path.join(dir, `${record.id}.json`), JSON.stringify(record, null, 2));
}

/**
 * Imports the pre-per-record file into the directory layout, once, keyed by id
 * so re-running is a no-op and never duplicates or overwrites a live record.
 */
function migrateLegacyCollection<T extends { id: string }>(legacyPath: string, dir: string, key: string): void {
  if (isMissing(legacyPath)) return;
  let legacy: { [key: string]: unknown[] } | null;
  try {
    legacy = readJsonFile<{ [key: string]: unknown[] }>(legacyPath);
  } catch (error) {
    console.error(`[state-store] could not migrate ${legacyPath}: ${(error as Error).message}`);
    return;
  }
  if (!legacy) return;
  const records = legacy[key];
  if (!Array.isArray(records)) return;
  let imported = 0;
  for (const record of records as T[]) {
    if (!record || typeof record.id !== 'string') continue;
    if (!isMissing(path.join(dir, `${record.id}.json`))) continue;
    try {
      writeRecord(dir, record);
      imported++;
    } catch (error) {
      console.error(`[state-store] could not migrate record ${record.id}: ${(error as Error).message}`);
    }
  }
  if (imported > 0) console.error(`[state-store] migrated ${imported} record(s) from ${legacyPath}`);
  try {
    fs.renameSync(legacyPath, `${legacyPath}.migrated`);
  } catch (error) {
    console.error(`[state-store] could not retire ${legacyPath}: ${(error as Error).message}`);
  }
}

export function loadConfig(): XnoConfig {
  return readJsonFile<XnoConfig>(getConfigPath()) ?? {};
}

export function saveConfig(config: XnoConfig): void {
  saveJsonFile(getConfigPath(), config);
}

export function listPaymentRequests(): PaymentRequest[] {
  const dir = getPaymentsDir();
  migrateLegacyCollection<PaymentRequest>(getLegacyPaymentsPath(), dir, 'requests');
  return readRecordDir<PaymentRequest>(dir).sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

export function getPaymentRequest(id: string): PaymentRequest | null {
  if (!/^[A-Za-z0-9._-]+$/.test(id)) return null;
  return readJsonFile<PaymentRequest>(path.join(getPaymentsDir(), `${id}.json`));
}

export function putPaymentRequest(record: PaymentRequest): void {
  writeRecord(getPaymentsDir(), record);
}

/**
 * Read-modify-write against the file, so a concurrent instance that wrote
 * between our read and write is not silently discarded.
 */
export function updatePaymentRequest(id: string, mutate: (record: PaymentRequest) => void): PaymentRequest {
  const current = getPaymentRequest(id);
  if (!current) throw new Error(`Payment request not found: ${id}`);
  mutate(current);
  current.updatedAt = new Date().toISOString();
  putPaymentRequest(current);
  return current;
}

export function listTransactions(): TransactionRecord[] {
  const dir = getTransactionsDir();
  migrateLegacyCollection<TransactionRecord>(getLegacyTransactionsPath(), dir, 'transactions');
  return readRecordDir<TransactionRecord>(dir).sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0));
}

export function putTransactionRecord(record: TransactionRecord): void {
  writeRecord(getTransactionsDir(), record);
}
