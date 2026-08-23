import { WorkType, workTypeToHex } from 'nano-rspow-node';

const HEX_16 = /^[0-9a-f]{16}$/i;

function toWorkType(difficultyLower: string): WorkType | undefined {
  if (difficultyLower === 'send') return WorkType.Send;
  if (difficultyLower === 'receive') return WorkType.Receive;
  // Keep the old symbolic spelling as a legacy compatibility input only.
  if (difficultyLower === 'legacyepoch1' || difficultyLower === 'legacy-epoch1' || difficultyLower === 'epoch1') {
    return WorkType.LegacyEpoch1;
  }
  if (difficultyLower === 'dev') return WorkType.Dev;
  return undefined;
}

export function normalizeRemoteWorkDifficulty(difficulty: string): string {
  const trimmed = difficulty.trim();
  if (HEX_16.test(trimmed)) return trimmed.toLowerCase();

  const wt = toWorkType(trimmed.toLowerCase());
  if (!wt) return difficulty;

  return workTypeToHex(wt).toLowerCase();
}
