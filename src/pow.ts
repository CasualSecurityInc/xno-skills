import { getProofOfWork, THRESHOLD__OPEN_RECEIVE, THRESHOLD__SEND_CHANGE } from 'nano-pow-with-fallback';

export type PowThreshold = 'send' | 'open';

let powServiceReady = false;

async function ensurePowReady(): Promise<void> {
  if (powServiceReady) return;
  try {
    await getProofOfWork({ hash: '0'.repeat(64).toLowerCase(), threshold: THRESHOLD__SEND_CHANGE });
    powServiceReady = true;
  } catch {
    powServiceReady = true;
  }
}

export async function localWorkGenerate(
  rootOrHash: string,
  threshold: PowThreshold = 'send'
): Promise<{ work: string }> {
  if (typeof rootOrHash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(rootOrHash)) {
    throw new Error('work root/hash must be 32-byte hex (64 hex characters)');
  }

  await ensurePowReady();

  const thresholdValue = threshold === 'open' ? THRESHOLD__OPEN_RECEIVE : THRESHOLD__SEND_CHANGE;
  const proofOfWork = await getProofOfWork({
    hash: rootOrHash.toLowerCase(),
    threshold: thresholdValue,
  });

  if (!proofOfWork || typeof proofOfWork !== 'string') {
    throw new Error('Local PoW generation failed');
  }

  return { work: proofOfWork.toUpperCase() };
}

export function getThresholdForSubtype(subtype: 'send' | 'receive' | 'open' | 'change'): PowThreshold {
  return subtype === 'open' || subtype === 'receive' ? 'open' : 'send';
}