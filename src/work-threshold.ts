import { type WorkType, workTypeToHex } from '@openrai/nano-core';

const HEX_16 = /^[0-9a-f]{16}$/i;

function toWorkType(difficultyLower: string): WorkType | undefined {
  if (difficultyLower === 'send') return 'Send' as WorkType;
  if (difficultyLower === 'receive') return 'Receive' as WorkType;
  if (difficultyLower === 'epoch1') return 'Epoch1' as WorkType;
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
