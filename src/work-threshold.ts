import {
  LegacyWorkType,
  TestingWorkType,
  WorkType,
  legacyWorkTypeToHex,
  testingWorkTypeToHex,
  workTypeToHex,
} from 'nano-rspow-node';

const HEX_16 = /^[0-9a-f]{16}$/i;

function toWorkThreshold(difficultyLower: string): string | undefined {
  if (difficultyLower === 'send') return workTypeToHex(WorkType.Send);
  if (difficultyLower === 'receive') return workTypeToHex(WorkType.Receive);
  // Keep the old symbolic spelling as a legacy compatibility input only.
  if (difficultyLower === 'legacyepoch1' || difficultyLower === 'legacy-epoch1' || difficultyLower === 'epoch1') {
    return legacyWorkTypeToHex(LegacyWorkType.Epoch1);
  }
  if (difficultyLower === 'dev') return testingWorkTypeToHex(TestingWorkType.Dev);
  return undefined;
}

export function normalizeRemoteWorkDifficulty(difficulty: string): string {
  const trimmed = difficulty.trim();
  if (HEX_16.test(trimmed)) return trimmed.toLowerCase();

  const threshold = toWorkThreshold(trimmed.toLowerCase());
  if (!threshold) return difficulty;

  return threshold.toLowerCase();
}
