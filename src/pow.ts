import { WorkDifficulty } from '@openrai/nano-core';
import { createNodePowEngine, WorkProvider } from '@openrai/nano-core/node';

const workProvider = WorkProvider.local({ localEngine: createNodePowEngine() });

export function validateWork(work: string): void {
  if (!work || !/^[0-9A-F]{16}$/.test(work)) {
    throw new Error(`Local PoW returned invalid work nonce (expected 16-char uppercase hex): "${work}"`);
  }
}

export async function localWorkGenerate(
  rootOrHash: string,
  threshold: WorkDifficulty = WorkDifficulty.Send,
): Promise<{ work: string }> {
  if (typeof rootOrHash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(rootOrHash)) {
    throw new Error('work root/hash must be 32-byte hex (64 hex characters)');
  }

  const proofOfWork = await workProvider.generate(rootOrHash.toLowerCase(), threshold);

  if (!proofOfWork || typeof proofOfWork !== 'string') {
    throw new Error('Local PoW generation failed');
  }

  const work = proofOfWork.toUpperCase();
  validateWork(work);

  return { work };
}

export function getThresholdForSubtype(subtype: 'send' | 'receive' | 'open' | 'change'): WorkDifficulty {
  return subtype === 'open' || subtype === 'receive' ? WorkDifficulty.Receive : WorkDifficulty.Send;
}
