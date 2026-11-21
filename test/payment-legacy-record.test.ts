import { describe, expect, it } from 'vitest';
import type { PaymentRequest } from '../src/state-store.js';
import { applyPaymentReceive, paymentReceivedRaw } from '../src/payment-state.js';

// A record written by a version that did not carry receivedBlocks, or by a hand edit, has no array there. Reads already
// answer `(rec.receivedBlocks || [])`, so the state is treated as "nothing received yet"; the write path did not, and
// `rec.receivedBlocks.push(...)` threw a TypeError on exactly that record. The payer's money is already on chain at that
// point, so the receive cannot be recorded and the request stays pending forever.
function legacyRequest(): PaymentRequest {
  const rec = {
    id: 'req-legacy',
    owsWalletId: 'A',
    accountIndex: 0,
    address: 'nano_receiver',
    amountRaw: '100',
    reason: 'test',
    status: 'pending',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  } as unknown as PaymentRequest;
  delete (rec as { receivedBlocks?: unknown }).receivedBlocks;
  return rec;
}

describe('a payment request without a receivedBlocks array', () => {
  it('records the receive instead of throwing', () => {
    const rec = legacyRequest();
    expect(paymentReceivedRaw(rec)).toBe(0n); // reads already tolerate the missing array
    applyPaymentReceive(rec, [{ hash: 'receive-1', sendHash: 'send-1', source: 'nano_source', amountRaw: '100' }]);
    expect(paymentReceivedRaw(rec)).toBe(100n);
    expect(rec.status).toBe('received');
  });
});
