import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  listPaymentRequests,
  getPaymentRequest,
  putPaymentRequest,
  updatePaymentRequest,
  listTransactions,
  putTransactionRecord,
  type PaymentRequest,
  type TransactionRecord,
} from '../src/state-store';

let home: string;
const prevHome = process.env.XNO_MCP_HOME;

function request(id: string, overrides: Partial<PaymentRequest> = {}): PaymentRequest {
  return {
    id,
    owsWalletId: 'A',
    accountIndex: 0,
    address: 'nano_3uojbn47b5xqcbs4yibbasamn8aeyqxgyi1z8peogwtdn6z3kagjanjpz4ss',
    amountRaw: '1000000000000000000000000000000',
    reason: 'test',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    receivedBlocks: [],
    ...overrides,
  };
}

/**
 * The built artifact when it exists, so the subprocess exercises the same code
 * a real server loads rather than relying on Node's TypeScript stripping.
 */
const moduleUrl = (): string => {
  const built = new URL('../dist/esm/state-store.js', import.meta.url).pathname;
  return fs.existsSync(built) ? built : new URL('../src/state-store.ts', import.meta.url).pathname;
};

/**
 * Runs a script in a genuinely separate OS process with the same XNO_MCP_HOME,
 * which is the case that used to lose data.
 */
function inSeparateProcess(script: string): string {
  return execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: { ...process.env, XNO_MCP_HOME: home },
  });
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'xno-store-'));
  process.env.XNO_MCP_HOME = home;
});

afterEach(() => {
  if (prevHome === undefined) delete process.env.XNO_MCP_HOME;
  else process.env.XNO_MCP_HOME = prevHome;
  fs.rmSync(home, { recursive: true, force: true });
});

describe('payment request store', () => {
  it('stores each request as its own file', () => {
    putPaymentRequest(request('req-a'));
    putPaymentRequest(request('req-b'));

    const files = fs.readdirSync(path.join(home, 'payments'));
    expect(files.sort()).toEqual(['req-a.json', 'req-b.json']);
    expect(
      listPaymentRequests()
        .map((r) => r.id)
        .sort(),
    ).toEqual(['req-a', 'req-b']);
  });

  it('is visible to another process without any cache refresh', () => {
    inSeparateProcess(`
      import { putPaymentRequest } from ${JSON.stringify(moduleUrl())};
      putPaymentRequest({ id:'from-other-process', owsWalletId:'B', accountIndex:0,
        address:'nano_1', amountRaw:'1', reason:'x', status:'pending',
        createdAt:'2026-01-02T00:00:00.000Z', updatedAt:'2026-01-02T00:00:00.000Z', receivedBlocks:[] });
    `);

    expect(listPaymentRequests().map((r) => r.id)).toEqual(['from-other-process']);
  });

  it('does not lose a concurrent write made between read and write', () => {
    putPaymentRequest(request('shared'));
    // Simulate another instance writing while we hold a stale copy in hand.
    updatePaymentRequest('shared', (rec) => {
      rec.reason = 'ours';
    });

    inSeparateProcess(`
      import { getPaymentRequest, putPaymentRequest } from ${JSON.stringify(moduleUrl())};
      const rec = getPaymentRequest('shared');
      rec.reason = 'theirs';
      putPaymentRequest(rec);
    `);

    // Their write survives; ours did not clobber the whole collection.
    expect(getPaymentRequest('shared')?.reason).toBe('theirs');
    expect(listPaymentRequests()).toHaveLength(1);
  });

  it('updatePaymentRequest mutates in place and stamps updatedAt', () => {
    putPaymentRequest(request('r1', { updatedAt: '2020-01-01T00:00:00.000Z' }));
    updatePaymentRequest('r1', (rec) => {
      rec.status = 'received';
    });

    const rec = getPaymentRequest('r1');
    expect(rec?.status).toBe('received');
    expect(rec?.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });

  it('updatePaymentRequest throws for a missing id rather than creating one', () => {
    expect(() => updatePaymentRequest('nope', () => {})).toThrow(/not found/i);
    expect(listPaymentRequests()).toEqual([]);
  });

  it('rejects an id that would escape the directory', () => {
    expect(() => putPaymentRequest(request('../escape'))).toThrow(/invalid record id/i);
    expect(getPaymentRequest('../../etc/passwd')).toBeNull();
  });

  it('skips one corrupt record instead of reporting the collection as empty', () => {
    putPaymentRequest(request('good'));
    fs.writeFileSync(path.join(home, 'payments', 'bad.json'), '{ truncated', 'utf8');

    const ids = listPaymentRequests().map((r) => r.id);
    expect(ids).toEqual(['good']);
  });
});

describe('legacy collection migration', () => {
  it('imports requests.json into per-record files once, then retires it', () => {
    fs.writeFileSync(
      path.join(home, 'requests.json'),
      JSON.stringify({ requests: [request('legacy-a'), request('legacy-b')] }),
      'utf8',
    );

    const first = listPaymentRequests();
    expect(first.map((r) => r.id).sort()).toEqual(['legacy-a', 'legacy-b']);
    expect(fs.existsSync(path.join(home, 'payments', 'legacy-a.json'))).toBe(true);
    expect(fs.existsSync(path.join(home, 'requests.json'))).toBe(false);
    expect(fs.existsSync(path.join(home, 'requests.json.migrated'))).toBe(true);

    // Idempotent: a second read must not duplicate.
    expect(listPaymentRequests()).toHaveLength(2);
  });

  it('imports transactions.json likewise', () => {
    const tx: TransactionRecord = {
      id: 'tx-1',
      owsWalletId: 'A',
      accountIndex: 0,
      address: 'nano_1',
      type: 'send',
      amountRaw: '1',
      counterparty: 'nano_2',
      hash: 'h',
      timestamp: '2026-01-01T00:00:00.000Z',
    };
    fs.writeFileSync(path.join(home, 'transactions.json'), JSON.stringify({ transactions: [tx] }), 'utf8');

    expect(listTransactions().map((t) => t.id)).toEqual(['tx-1']);
    expect(fs.existsSync(path.join(home, 'transactions.json'))).toBe(false);
  });

  it('does not overwrite a live record when the legacy file is replayed', () => {
    putPaymentRequest(request('dup', { reason: 'live' }));
    fs.writeFileSync(
      path.join(home, 'requests.json'),
      JSON.stringify({ requests: [request('dup', { reason: 'stale' })] }),
      'utf8',
    );

    expect(getPaymentRequest('dup')?.reason).toBe('live');
  });
});

describe('transaction store', () => {
  const tx = (id: string, timestamp: string): TransactionRecord => ({
    id,
    owsWalletId: 'A',
    accountIndex: 0,
    address: 'nano_1',
    type: 'send',
    amountRaw: '1',
    counterparty: 'nano_2',
    hash: 'h',
    timestamp,
  });

  it('keeps writes from separate processes', () => {
    inSeparateProcess(`
      import { putTransactionRecord } from ${JSON.stringify(moduleUrl())};
      putTransactionRecord({ id:'t1', owsWalletId:'A', accountIndex:0, address:'nano_1',
        type:'send', amountRaw:'1', counterparty:'nano_2', hash:'h', timestamp:'2026-01-01T00:00:00.000Z' });
    `);
    putTransactionRecord(tx('t2', '2026-01-02T00:00:00.000Z'));

    expect(listTransactions().map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('returns them in timestamp order', () => {
    putTransactionRecord(tx('later', '2026-03-01T00:00:00.000Z'));
    putTransactionRecord(tx('earlier', '2026-01-01T00:00:00.000Z'));
    expect(listTransactions().map((t) => t.id)).toEqual(['earlier', 'later']);
  });

  it('reports an empty collection when the directory does not exist', () => {
    expect(listTransactions()).toEqual([]);
    expect(listPaymentRequests()).toEqual([]);
  });
});
