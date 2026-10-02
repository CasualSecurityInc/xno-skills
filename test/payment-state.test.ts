import { describe, expect, it } from 'vitest';
import type { PaymentRequest } from '../src/state-store.js';
import {
  applyPaymentReceive,
  paymentMissingSourceRaw,
  paymentReceivedRaw,
  recordPaymentRefund,
  refundCandidates,
  selectPaymentReceiveHash,
} from '../src/payment-state.js';

function request(amountRaw: string): PaymentRequest {
  return {
    id: 'req-1',
    owsWalletId: 'A',
    accountIndex: 0,
    address: 'nano_receiver',
    amountRaw,
    reason: 'test',
    status: 'pending',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    receivedBlocks: [],
  };
}

describe('payment receive selection', () => {
  it('never guesses between multiple pending Nano sends', () => {
    expect(selectPaymentReceiveHash([])).toBeUndefined();
    expect(selectPaymentReceiveHash([{ hash: 'a' }])).toBe('a');
    expect(() => selectPaymentReceiveHash([{ hash: 'a' }, { hash: 'b' }])).toThrow(/Refusing to guess/i);
    expect(selectPaymentReceiveHash([{ hash: 'a' }, { hash: 'b' }], 'b')).toBe('b');
    expect(() => selectPaymentReceiveHash([{ hash: 'a' }], 'b')).toThrow(/not currently receivable/i);
  });
});
describe('tracked payment state', () => {
  it('records receive provenance once and advances partial to received', () => {
    const rec = request('100');
    applyPaymentReceive(rec, [
      {
        hash: 'receive-1',
        sendHash: 'send-1',
        source: 'nano_source',
        amountRaw: '40',
      },
    ]);
    expect(rec.status).toBe('partial');
    expect(paymentReceivedRaw(rec)).toBe(40n);

    applyPaymentReceive(rec, [
      { hash: 'receive-1', sendHash: 'send-1', source: 'nano_source', amountRaw: '40' },
      { hash: 'receive-2', sendHash: 'send-2', source: 'nano_source', amountRaw: '60' },
    ]);
    expect(rec.status).toBe('received');
    expect(paymentReceivedRaw(rec)).toBe(100n);
    expect(rec.receivedBlocks).toHaveLength(2);
    expect(refundCandidates(rec)).toEqual([
      { address: 'nano_source', amountRaw: '100', amountXno: '0.0000000000000000000000000001' },
    ]);
  });

  it('refuses to invent a source and makes refunds idempotent in state', () => {
    const rec = request('100');
    applyPaymentReceive(rec, [{ hash: 'receive-1', sendHash: 'send-1', amountRaw: '100' }]);
    expect(paymentMissingSourceRaw(rec)).toBe(100n);
    expect(refundCandidates(rec)).toEqual([]);
    const known = request('100');
    applyPaymentReceive(known, [
      {
        hash: 'receive-2',
        sendHash: 'send-2',
        source: 'nano_source',
        amountRaw: '100',
      },
    ]);
    recordPaymentRefund(known, 'nano_source', '100', 'refund-1');
    expect(known.status).toBe('refunded');
    expect(refundCandidates(known)).toEqual([]);
  });

  it('refunds only the still-unrefunded amount for each recorded source', () => {
    const rec = request('100');
    applyPaymentReceive(rec, [
      { hash: 'r1', sendHash: 's1', source: 'nano_a', amountRaw: '70' },
      { hash: 'r2', sendHash: 's2', source: 'nano_b', amountRaw: '30' },
    ]);
    recordPaymentRefund(rec, 'nano_a', '20', 'out-1');
    expect(refundCandidates(rec)).toEqual([
      { address: 'nano_a', amountRaw: '50', amountXno: '0.00000000000000000000000000005' },
      { address: 'nano_b', amountRaw: '30', amountXno: '0.00000000000000000000000000003' },
    ]);
    expect(rec.status).toBe('received');
  });
});
