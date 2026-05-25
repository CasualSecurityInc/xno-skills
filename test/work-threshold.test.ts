import { describe, expect, it } from 'vitest';
import { normalizeRemoteWorkDifficulty } from '../src/work-threshold.js';

describe('normalizeRemoteWorkDifficulty', () => {
  it('maps symbolic work types to authoritative hex thresholds', () => {
    expect(normalizeRemoteWorkDifficulty('Send')).toBe('fffffff800000000');
    expect(normalizeRemoteWorkDifficulty('Receive')).toBe('fffffe0000000000');
    expect(normalizeRemoteWorkDifficulty('Epoch1')).toBe('ffffffc000000000');
    expect(normalizeRemoteWorkDifficulty('Dev')).toBe('fe00000000000000');
  });

  it('accepts case-insensitive symbolic names', () => {
    expect(normalizeRemoteWorkDifficulty('send')).toBe('fffffff800000000');
    expect(normalizeRemoteWorkDifficulty('RECEIVE')).toBe('fffffe0000000000');
  });

  it('passes through 16-char hex and lowercases it', () => {
    expect(normalizeRemoteWorkDifficulty('FFFFFFF800000000')).toBe('fffffff800000000');
  });

  it('passes through unknown values unchanged', () => {
    expect(normalizeRemoteWorkDifficulty('not-a-work-type')).toBe('not-a-work-type');
  });
});
