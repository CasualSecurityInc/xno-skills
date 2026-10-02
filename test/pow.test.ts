import { describe, it, expect } from 'vitest';
import { localWorkGenerate, getThresholdForSubtype, validateWork, WorkType } from '../src/pow';
import { normalizeRemoteWorkDifficulty } from '../src/work-threshold';
import { createNodePowEngine } from '@openrai/nano-core/node';

describe('Local PoW', () => {
  it('should return correct threshold for subtype', () => {
    expect(getThresholdForSubtype('send')).toBe(WorkType.Send);
    expect(getThresholdForSubtype('change')).toBe(WorkType.Send);
    expect(getThresholdForSubtype('receive')).toBe(WorkType.Receive);
    expect(getThresholdForSubtype('open')).toBe(WorkType.Receive);
  });

  it('should hand the engine canonical hex, not the symbolic WorkType spelling', async () => {
    // Regression: nano-actions.ts:249 and getThresholdForSubtype pass WorkType.Send /
    // WorkType.Receive, but the engine contract reads "Callers provide canonical
    // hexadecimal strings". The engine rejects the symbolic form outright:
    //   generate(root, "Send") -> Invalid threshold hex: invalid digit found in string
    // so we assert on the normalized value rather than paying for a real 2^64 search.
    for (const [type, expected] of [
      [WorkType.Send, 'fffffff800000000'],
      [WorkType.Receive, 'fffffe0000000000'],
    ] as const) {
      expect(normalizeRemoteWorkDifficulty(type)).toBe(expected);
      expect(() => normalizeRemoteWorkDifficulty(type)).not.toThrow();
    }
    // The engine itself refuses the unnormalized form; that is what the fix avoids.
    // It throws synchronously, so wrap the call rather than awaiting the promise.
    expect(() => createNodePowEngine().generate('0'.repeat(64), WorkType.Send)).toThrow(
      'Invalid threshold hex',
    );
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
