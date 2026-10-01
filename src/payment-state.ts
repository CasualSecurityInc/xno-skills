import { rawToNano } from './convert.js';
import type { PaymentRequest } from './state-store.js';

export type PaymentReceiveBlock = {
  hash: string;
  sendHash: string;
  source?: string;
  amountRaw: string;
};

export function paymentReceivedRaw(rec: PaymentRequest): bigint {
  return (rec.receivedBlocks || []).reduce((sum, block) => sum + BigInt(block.amountRaw), 0n);
}

export function paymentRefundedRaw(rec: PaymentRequest): bigint {
  return (rec.refundedBlocks || []).reduce((sum, block) => sum + BigInt(block.amountRaw), 0n);
}

export function refreshPaymentStatus(rec: PaymentRequest): void {
  const received = paymentReceivedRaw(rec);
  const refunded = paymentRefundedRaw(rec);
  if (received > 0n && refunded >= received) rec.status = 'refunded';
  else if (received === 0n) rec.status = 'pending';
  else if (received < BigInt(rec.amountRaw)) rec.status = 'partial';
  else rec.status = 'received';
  rec.updatedAt = new Date().toISOString();
}
export function applyPaymentReceive(rec: PaymentRequest, blocks: PaymentReceiveBlock[]): void {
  for (const block of blocks) {
    if ((rec.receivedBlocks || []).some((existing) => existing.sendHash === block.sendHash)) continue;
    rec.receivedBlocks.push({
      sendHash: block.sendHash,
      source: block.source,
      amountRaw: block.amountRaw,
      receiveHash: block.hash,
    });
  }
  refreshPaymentStatus(rec);
}

export type RefundCandidate = {
  address: string;
  amountRaw: string;
  amountXno: string;
};

export function refundCandidates(rec: PaymentRequest): RefundCandidate[] {
  const bySource = new Map<string, bigint>();
  for (const block of rec.receivedBlocks || []) {
    if (!block.source) continue;
    bySource.set(block.source, (bySource.get(block.source) || 0n) + BigInt(block.amountRaw));
  }
  for (const block of rec.refundedBlocks || []) {
    bySource.set(block.source, (bySource.get(block.source) || 0n) - BigInt(block.amountRaw));
  }
  return [...bySource.entries()]
    .filter(([, amount]) => amount > 0n)
    .map(([address, amount]) => ({
      address,
      amountRaw: amount.toString(),
      amountXno: rawToNano(amount.toString()),
    }));
}

export function paymentMissingSourceRaw(rec: PaymentRequest): bigint {
  return (rec.receivedBlocks || [])
    .filter((block) => !block.source)
    .reduce((sum, block) => sum + BigInt(block.amountRaw), 0n);
}

export function recordPaymentRefund(
  rec: PaymentRequest,
  source: string,
  amountRaw: string,
  sendHash: string,
): void {
  rec.refundedBlocks = [...(rec.refundedBlocks || []), {
    source,
    amountRaw,
    sendHash,
    timestamp: new Date().toISOString(),
  }];
  refreshPaymentStatus(rec);
}
