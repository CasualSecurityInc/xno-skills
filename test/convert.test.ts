import { describe, it, expect } from 'vitest';
import { nanoToRaw, rawToNano, formatNano, knanoToRaw, mnanoToRaw } from '../src/convert';

describe('nanoToRaw', () => {
  it('converts 1 nano to raw', () => {
    expect(nanoToRaw('1')).toBe('1000000000000000000000000000000');
  });

  it('preserves all 30 decimal places', () => {
    expect(nanoToRaw('1.000000000000000000000000000001')).toBe('1000000000000000000000000000001');
  });

  it('handles integer values', () => {
    expect(nanoToRaw('10')).toBe('10000000000000000000000000000000');
    expect(nanoToRaw('100')).toBe('100000000000000000000000000000000');
  });

  it('handles zero', () => {
    expect(nanoToRaw('0')).toBe('0');
  });

  it('handles small decimal values', () => {
    expect(nanoToRaw('0.1')).toBe('100000000000000000000000000000');
    expect(nanoToRaw('0.000000000000000000000000000001')).toBe('1');
  });

  it('truncates decimals beyond 30 places', () => {
    expect(nanoToRaw('1.0000000000000000000000000000012')).toBe('1000000000000000000000000000001');
  });

  it('handles empty string', () => {
    expect(nanoToRaw('')).toBe('0');
  });
});

describe('rawToNano', () => {
  it('converts 1 raw to nano', () => {
    expect(rawToNano('1')).toBe('0.000000000000000000000000000001');
  });

  it('converts 10^30 raw to 1 nano', () => {
    expect(rawToNano('1000000000000000000000000000000')).toBe('1');
  });

  it('respects custom decimals parameter', () => {
    expect(rawToNano('1', 5)).toBe('0.00000');
  });

  it('handles zero', () => {
    expect(rawToNano('0')).toBe('0');
  });

  it('handles large values', () => {
    expect(rawToNano('10000000000000000000000000000000')).toBe('10');
  });

  it('preserves decimal precision', () => {
    expect(rawToNano('1000000000000000000000000000001')).toBe('1.000000000000000000000000000001');
  });

  it('handles empty string', () => {
    expect(rawToNano('')).toBe('0');
  });
});

describe('formatNano', () => {
  it('formats 0 raw', () => {
    expect(formatNano('0')).toBe('0');
  });

  it('formats 1 raw', () => {
    expect(formatNano('1')).toBe('0.000000000000000000000000000001');
  });

  it('formats 10^30 raw', () => {
    expect(formatNano('1000000000000000000000000000000')).toBe('1');
  });

  it('formats large values', () => {
    expect(formatNano('1234567890000000000000000000000')).toBe('1.23456789');
  });

  it('handles empty string', () => {
    expect(formatNano('')).toBe('0');
  });
});

describe('knanoToRaw', () => {
  it('converts 1 knano to raw', () => {
    expect(knanoToRaw('1')).toBe('1000000000000000000000000000000000');
  });

  it('handles decimals', () => {
    expect(knanoToRaw('1.001')).toBe('1001000000000000000000000000000000');
  });
});

describe('mnanoToRaw', () => {
  it('converts 1 mnano to raw', () => {
    expect(mnanoToRaw('1')).toBe('1000000000000000000000000000000000000');
  });

  it('handles decimals', () => {
    expect(mnanoToRaw('1.001')).toBe('1001000000000000000000000000000000000');
  });
});
