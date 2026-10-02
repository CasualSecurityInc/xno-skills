import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { nanoToRaw, rawToNano, formatNano, convertUnits } from '../src/convert';

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

  it('rejects negative values', () => {
    expect(() => nanoToRaw('-1')).toThrow('nanoToRaw: negative values not supported');
    expect(() => nanoToRaw('-0.5')).toThrow('nanoToRaw: negative values not supported');
  });

  it('rejects scientific notation', () => {
    expect(() => nanoToRaw('1e5')).toThrow('nanoToRaw: scientific notation not supported, use decimal string');
    expect(() => nanoToRaw('2.5e3')).toThrow('nanoToRaw: scientific notation not supported, use decimal string');
    expect(() => nanoToRaw('1E5')).toThrow('nanoToRaw: scientific notation not supported, use decimal string');
  });

  it('rejects nonzero input that truncates to zero', () => {
    expect(() => nanoToRaw('0.0000000000000000000000000000009')).toThrow('nanoToRaw: nonzero value rounds to 0 raw');
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

  it('rejects negative values', () => {
    expect(() => rawToNano('-1500000000000000000000000000000')).toThrow('rawToNano: negative values not supported');
    expect(() => rawToNano('-1')).toThrow('rawToNano: negative values not supported');
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

describe('convertUnits', () => {
  it('converts xno to raw', () => {
    expect(convertUnits('1.5', 'xno', 'raw')).toBe('1500000000000000000000000000000');
  });

  it('converts raw to xno', () => {
    expect(convertUnits('1500000000000000000000000000000', 'raw', 'xno')).toBe('1.5');
  });

  it('returns same value for same unit', () => {
    expect(convertUnits('42', 'raw', 'raw')).toBe('42');
  });

  it('rejects unsupported units', () => {
    expect(() => convertUnits('1', 'btc', 'xno')).toThrow('Unsupported unit: btc');
  });
});
describe('fractional raw input (regression: silent truncation)', () => {
  it('rawToNano must not silently ignore a fractional raw part', () => {
    // raw is the smallest indivisible unit; 1.5 raw is not a valid amount.
    // Either throw, or do not return a value computed from the integer part alone.
    expect(() => rawToNano('1.5')).toThrow();
  });

  it('a fractional raw input must not produce a self-inconsistent pair', () => {
    // Reproducer of the CLI shape: raw: "1.5" while xno is computed from 1.
    let threw = false;
    let xno = '';
    try {
      xno = rawToNano('1.5');
    } catch {
      threw = true;
    }
    if (!threw) {
      // If it does not throw, the returned xno must not be the value for plain "1".
      expect(xno).not.toBe(rawToNano('1'));
    }
  });
});

describe('CLI error handling for convert (regression: uncaught throw)', () => {
  it('converts errors to a clean one-line message, not a Node stack trace', () => {
    const cli = path.resolve(__dirname, '../bin/xno-skills');
    let out = '';
    let code = 0;
    try {
      execSync(`node ${cli} convert "-1" xno`, { stdio: 'pipe' });
    } catch (e: any) {
      out = String(e.stdout || '') + String(e.stderr || '');
      code = e.status ?? 1;
    }
    expect(code).not.toBe(0);
    expect(out).toContain('negative values not supported');
    expect(out).not.toContain('at Object.<anonymous>');
    expect(out).not.toMatch(/file:\/\/.*\.js:\d+/);
  });
});

describe('numeric input (a caller may pass Number or String)', () => {
  it('nanoToRaw accepts a number and agrees with the string form', () => {
    // A double carries ~16 significant digits, well under the 1e-30 XNO quantum,
    // so the number and the string must convert to the same raw amount.
    expect(nanoToRaw(1.5)).toBe(nanoToRaw('1.5'));
    expect(nanoToRaw(0.1)).toBe(nanoToRaw('0.1'));
    expect(nanoToRaw(42)).toBe(nanoToRaw('42'));
    expect(nanoToRaw(1.5)).toBe('1500000000000000000000000000000');
  });

  it('nanoToRaw expands integers past the exponent-notation threshold', () => {
    // String(1e21) is "1e+21", which the scientific-notation guard rejects.
    expect(nanoToRaw(1e21)).toBe('1' + '0'.repeat(51));
    expect(() => nanoToRaw(1e21)).not.toThrow();
  });

  it('nanoToRaw rejects non-finite and negative numbers', () => {
    expect(() => nanoToRaw(NaN)).toThrow(/finite/);
    expect(() => nanoToRaw(Infinity)).toThrow(/finite/);
    expect(() => nanoToRaw(-Infinity)).toThrow(/finite/);
    expect(() => nanoToRaw(-1)).toThrow('nanoToRaw: negative values not supported');
  });

  it('rawToNano accepts a safe integer', () => {
    expect(rawToNano(1)).toBe(rawToNano('1'));
    expect(rawToNano(0)).toBe('0');
  });

  it('rawToNano rejects a raw amount a double cannot hold exactly', () => {
    // 1e30 raw is exactly 1 XNO, but 1e30 > 2^53, so the number is already a
    // rounded approximation of the amount it claims to be.
    expect(() => rawToNano(1e30)).toThrow(/MAX_SAFE_INTEGER/);
    expect(() => rawToNano(1.5)).toThrow(/whole number/);
    expect(() => rawToNano(NaN)).toThrow(/finite/);
    expect(() => rawToNano(-1)).toThrow('rawToNano: negative values not supported');
  });

  it('formatNano applies the same raw-side rule', () => {
    expect(formatNano(1)).toBe(formatNano('1'));
    expect(() => formatNano(1e30)).toThrow(/MAX_SAFE_INTEGER/);
    expect(() => formatNano(1.5)).toThrow(/whole number/);
  });

  it('convertUnits coerces numbers on both sides', () => {
    expect(convertUnits(1.5, 'xno', 'raw')).toBe(convertUnits('1.5', 'xno', 'raw'));
    expect(convertUnits(5, 'raw', 'xno')).toBe(convertUnits('5', 'raw', 'xno'));
    // raw -> raw is a pass-through, so it must still return a string.
    expect(convertUnits(5, 'raw', 'raw')).toBe('5');
  });
});
