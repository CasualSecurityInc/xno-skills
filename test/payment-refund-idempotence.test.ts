import { describe, it, expect } from 'vitest';
import { recordPaymentRefund, refundCandidates, paymentRefundedRaw, refreshPaymentStatus } from '../src/payment-state';
import type { PaymentRequest } from '../src/state-store';

function recWith(received: Array<{ sendHash: string; source: string; amountRaw: string }>): PaymentRequest {
  return {
    id: 'r1',
    status: 'received',
    amountRaw: received.reduce((s, b) => s + BigInt(b.amountRaw), 0n).toString(),
    asset: 'XNO',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    receivedBlocks: received.map((b, i) => ({ ...b, receiveHash: `R${i}` })),
    refundedBlocks: [],
  } as unknown as PaymentRequest;
}

describe('refund recording is idempotent', () => {
  it('does not count the same refund twice', () => {
    // A retried payment_refund call, or a second instance that read the record
    // before the first one wrote, presents the same transaction hash again.
    const rec = recWith([{ sendHash: 'S1', source: 'nano_payer', amountRaw: '1000' }]);
    recordPaymentRefund(rec, 'nano_payer', '1000', 'TX_A');
    recordPaymentRefund(rec, 'nano_payer', '1000', 'TX_A');

    expect(paymentRefundedRaw(rec)).toBe(1000n);
    expect(refundCandidates(rec)).toHaveLength(0);
    refreshPaymentStatus(rec);
    expect(rec.status).toBe('refunded');
  });

  it('still records a genuine second refund of a second receive', () => {
    // The guard keys on sendHash, so two separate refunds of two separate
    // receives are both kept.
    const rec = recWith([
      { sendHash: 'S1', source: 'nano_payer', amountRaw: '1000' },
      { sendHash: 'S2', source: 'nano_payer', amountRaw: '400' },
    ]);
    recordPaymentRefund(rec, 'nano_payer', '1000', 'TX_A');
    recordPaymentRefund(rec, 'nano_payer', '400', 'TX_B');

    expect(paymentRefundedRaw(rec)).toBe(1400n);
    expect(refundCandidates(rec)).toHaveLength(0);
  });

  it('keeps a partial refund visible to the payer', () => {
    const rec = recWith([{ sendHash: 'S1', source: 'nano_payer', amountRaw: '1000' }]);
    recordPaymentRefund(rec, 'nano_payer', '300', 'TX_A');

    expect(paymentRefundedRaw(rec)).toBe(300n);
    expect(refundCandidates(rec)).toEqual([
      { address: 'nano_payer', amountRaw: '700', amountXno: expect.any(String) },
    ]);
  });
});
