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

function thresholdHex(threshold: PowThreshold): string {
  return threshold === 'open' ? THRESHOLD__OPEN_RECEIVE : THRESHOLD__SEND_CHANGE;
}

export function validateWork(work: string): void {
  if (!work || !/^[0-9A-F]{16}$/.test(work)) {
    throw new Error(`Local PoW returned invalid work nonce (expected 16-char uppercase hex): "${work}"`);
  }
  if (work === '0'.repeat(16)) {
    throw new Error(
      'Local PoW returned all-zero nonce (WASM backend likely broken). ' +
      'Set XNO_USE_WORK_PEER=true and NANO_RPC_URL to use remote work_generate instead.'
    );
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

  const thresholdValue = thresholdHex(threshold);
  const proofOfWork = await getProofOfWork({
    hash: rootOrHash.toLowerCase(),
    threshold: thresholdValue,
  });

  if (!proofOfWork || typeof proofOfWork !== 'string') {
    throw new Error('Local PoW generation failed');
  }

  const work = proofOfWork.toUpperCase();
  validateWork(work);

  return { work };
}

export function getThresholdForSubtype(subtype: 'send' | 'receive' | 'open' | 'change'): PowThreshold {
  return subtype === 'open' || subtype === 'receive' ? 'open' : 'send';
}
