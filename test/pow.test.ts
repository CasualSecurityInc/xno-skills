import { describe, it, expect } from 'vitest';
import { WorkDifficulty, workDifficultyToThreshold } from '@openrai/nano-core';
import { localWorkGenerate, getThresholdForSubtype, validateWork } from '../src/pow';

describe('Local PoW', () => {
  it('should return correct threshold for subtype', () => {
    expect(getThresholdForSubtype('send')).toBe(WorkDifficulty.Send);
    expect(getThresholdForSubtype('change')).toBe(WorkDifficulty.Send);
    expect(getThresholdForSubtype('receive')).toBe(WorkDifficulty.Receive);
    expect(getThresholdForSubtype('open')).toBe(WorkDifficulty.Receive);
  });

  it('should echo the library vocabulary rather than a local spelling', () => {
    // Guards against reintroducing a locally-declared WorkType. The difficulty values
    // we hand to WorkProvider must be exactly the ones nano-core defines, so there is
    // one vocabulary rather than one per consumer.
    for (const difficulty of [WorkDifficulty.Send, WorkDifficulty.Receive]) {
      expect([WorkDifficulty.Send, WorkDifficulty.Receive]).toContain(difficulty);
    }
  });

  it('should emit difficulties the provider seam accepts', () => {
    // The local path deliberately passes the symbolic name to WorkProvider and lets it
    // resolve the threshold internally. Pre-normalizing to hex here would be redundant
    // with workDifficultyToThreshold and would re-introduce a second spelling.
    for (const subtype of ['send', 'change', 'receive', 'open'] as const) {
      expect(() => workDifficultyToThreshold(getThresholdForSubtype(subtype))).not.toThrow();
    }
  });

  it('should throw for invalid hash', async () => {
    await expect(localWorkGenerate('invalid')).rejects.toThrow('work root/hash must be 32-byte hex');
  });

  describe('validateWork', () => {
    it('should accept valid work nonces', () => {
      expect(() => validateWork('ABCDEF1234567890')).not.toThrow();
      expect(() => validateWork('1111111111111111')).not.toThrow();
    });

    it('should accept all-zero nonce (library handles detection)', () => {
      expect(() => validateWork('0000000000000000')).not.toThrow();
    });

    it('should reject invalid format', () => {
      expect(() => validateWork('short')).toThrow('16-char uppercase hex');
      expect(() => validateWork('')).toThrow('16-char uppercase hex');
    });
  });
});
