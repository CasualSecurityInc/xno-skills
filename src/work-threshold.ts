import { type WorkType, workTypeToHex } from '@openrai/nano-core';

const HEX_16 = /^[0-9a-f]{16}$/i;

function toWorkType(difficultyLower: string): WorkType | undefined {
  if (difficultyLower === 'send') return 'Send' as WorkType;
  if (difficultyLower === 'receive') return 'Receive' as WorkType;
  // Keep the old symbolic spelling as a legacy compatibility input only.
  if (difficultyLower === 'legacyepoch1' || difficultyLower === 'legacy-epoch1' || difficultyLower === 'epoch1') {
    return 'LegacyEpoch1' as WorkType;
  }
  if (difficultyLower === 'dev') return 'Dev' as WorkType;
  return undefined;
}

export function normalizeRemoteWorkDifficulty(difficulty: string): string {
  const trimmed = difficulty.trim();
  if (HEX_16.test(trimmed)) return trimmed.toLowerCase();

  const wt = toWorkType(trimmed.toLowerCase());
  if (!wt) return difficulty;

  return workTypeToHex(wt).toLowerCase();
}
