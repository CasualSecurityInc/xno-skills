/**
 * Precise unit conversions for XNO (Nano) cryptocurrency using BigInt.
 *
 * Units:
 * - raw: base unit (10^0)
 * - XNO (Nano): 10^30 raw
 */

const NAN = 30n; // 10^30 - Nano to raw scale

/**
 * Remove leading zeros from a string representation of a number
 */
function stripLeadingZeros(str: string): string {
  // Handle negative numbers
  const isNegative = str.startsWith('-');
  if (isNegative) str = str.slice(1);

  // Strip leading zeros but keep at least one digit
  let result = str.replace(/^0+/, '') || '0';

  return isNegative ? '-' + result : result;
}

/**
 * Removes decimal point and returns { integer, decimal } parts
 */
function parseDecimal(value: string): { integer: string; decimal: string } {
  const isNegative = value.startsWith('-');
  if (isNegative) value = value.slice(1);

  const parts = value.split('.');
  const integer = parts[0] || '0';
  const decimal = parts[1] || '';

  return {
    integer: isNegative ? '-' + integer : integer,
    decimal,
  };
}

/**
 * Coerces a numeric XNO amount to the decimal string the parser expects.
 *
 * A double carries ~16 significant decimal digits, far more resolution than the
 * 1e-30 quantum of an XNO, so an XNO amount survives the trip intact. Integers
 * are expanded through BigInt because `String()` switches to exponent form at
 * 1e21, which the scientific-notation guard would then reject. Non-integers use
 * the shortest round-tripping form, so `nanoToRaw(0.1)` and `nanoToRaw('0.1')`
 * produce the same raw amount.
 */
// IEEE-754 guarantees 15 significant decimal digits round-trip. A longer
// shortest-repr means the value carries binary representation error, which is
// the double being the wrong number rather than a spelling of the right one.
const MAX_SIGNIFICANT_DIGITS = 15;

function coerceXnoNumber(value: number, fn: string): string {
  if (!Number.isFinite(value)) {
    throw new Error(`${fn}: expected a finite amount, got ${value}. Pass it as a decimal string.`);
  }
  if (value < 0) throw new Error(`${fn}: negative values not supported`);
  if (Number.isInteger(value)) return BigInt(value).toString();
  const repr = String(value);
  const significantDigits = repr.replace(/[^0-9]/g, '').replace(/^0+/, '').length;
  if (significantDigits > MAX_SIGNIFICANT_DIGITS) {
    throw new Error(
      `${fn}: ${repr} carries ${significantDigits} significant digits, more than a double holds faithfully. Pass it as a decimal string.`,
    );
  }
  return repr;
}

/**
 * Coerces a numeric raw amount to a decimal string.
 *
 * Raw is the smallest indivisible unit and 1 XNO is 1e30 raw, so every raw
 * amount above ~0.000009 XNO is already lossy as a JS number. Only safe
 * integers are accepted; anything else has to arrive as a string, or the caller
 * would be converting an approximation of the amount they asked for.
 */
function coerceRawNumber(value: number, fn: string): string {
  if (!Number.isFinite(value)) {
    throw new Error(`${fn}: expected a finite amount, got ${value}. Pass it as a decimal string.`);
  }
  if (!Number.isInteger(value)) {
    throw new Error(
      `${fn}: raw is the smallest indivisible unit, so a raw amount must be a whole number. Pass it as a string.`,
    );
  }
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${fn}: raw amount ${value} is above Number.MAX_SAFE_INTEGER and cannot be represented exactly as a number. Pass it as a string.`,
    );
  }
  return BigInt(value).toString();
}

/**
 * Converts Nano (XNO) to raw units.
 * @param nano - Nano amount as decimal string or number (supports decimals)
 * @returns Raw amount as string
 */
export function nanoToRaw(nano: string | number): string {
  if (typeof nano === 'number') nano = coerceXnoNumber(nano, 'nanoToRaw');
  if (!nano || nano === '') return '0';
  if (nano.startsWith('-')) throw new Error('nanoToRaw: negative values not supported');
  if (/[eE]/.test(nano)) throw new Error('nanoToRaw: scientific notation not supported, use decimal string');

  const { integer, decimal } = parseDecimal(nano);

  // Pad or truncate decimal to exactly 30 digits (10^30 scale)
  const paddedDecimal = decimal.slice(0, 30).padEnd(30, '0');

  // Combine integer and decimal parts
  const combined = integer + paddedDecimal;

  // Convert to BigInt and back to string
  const result = stripLeadingZeros(BigInt(combined).toString());

  if (result === '0' && nano !== '0' && /[1-9]/.test(nano)) {
    throw new Error('nanoToRaw: nonzero value rounds to 0 raw');
  }

  return result;
}

/**
 * Converts raw units to Nano (XNO).
 * @param raw - Raw amount as decimal string, or a number if it is a safe integer
 * @param decimals - Number of decimal places to return (default: 30)
 * @returns Nano amount as string
 */
export function rawToNano(raw: string | number, decimals: number = 30): string {
  if (typeof raw === 'number') raw = coerceRawNumber(raw, 'rawToNano');
  if (!raw || raw === '') return '0';
  if (raw.startsWith('-')) throw new Error('rawToNano: negative values not supported');

  const { integer: intPart, decimal: rawDecPart } = parseDecimal(raw);
  // raw is the smallest indivisible unit: a fractional raw value is not a valid amount.
  // Rejecting it prevents a silent, self-inconsistent result (raw echoed as "1.5" while
  // the XNO amount is computed from the integer part alone).
  if (rawDecPart.length > 0 && /[1-9]/.test(rawDecPart))
    throw new Error('rawToNano: raw amounts must be integers (raw is the smallest indivisible unit)');

  // Convert to BigInt first to handle the raw value
  const rawBigInt = BigInt(intPart);

  const nanoBigInt = rawBigInt / BigInt(10) ** NAN;
  const remainder = rawBigInt % BigInt(10) ** NAN;

  // Format with exact decimal places
  const remainderStr = remainder.toString().padStart(30, '0');
  const rawDecimalPart = remainderStr.slice(0, decimals);

  // Use default behavior (trim trailing zeros) when decimals=30
  const decimalPart = decimals === 30 ? rawDecimalPart.replace(/0+$/, '') : rawDecimalPart.padEnd(decimals, '0');

  const intStr = nanoBigInt === 0n ? '0' : nanoBigInt.toString();
  const result = decimalPart ? `${intStr}.${decimalPart}` : intStr;

  return result;
}

/**
 * Formats raw units as Nano (XNO) with full 30 decimal precision.
 * @param raw - Raw amount as decimal string, or a number if it is a safe integer
 * @returns Formatted Nano string
 */
export function formatNano(raw: string | number): string {
  if (typeof raw === 'number') raw = coerceRawNumber(raw, 'formatNano');
  if (!raw || raw === '') return '0';

  const { integer: intPart } = parseDecimal(raw);
  const rawBigInt = BigInt(intPart);

  // Get the Nano value and remainder
  const nanoBigInt = rawBigInt / BigInt(10) ** NAN;
  const remainder = rawBigInt % BigInt(10) ** NAN;

  // Format with exactly 30 decimal places
  const remainderStr = remainder.toString().padStart(30, '0');

  // Trim trailing zeros but keep at least one decimal if needed
  const trimmedDecimals = remainderStr.replace(/0+$/, '');

  if (trimmedDecimals) {
    return `${nanoBigInt}.${trimmedDecimals}`;
  }

  return nanoBigInt.toString();
}

/**
 * General unit conversion: converts amount from one unit to another.
 * Supported units: raw, xno
 * @param amount - Amount as decimal string or number
 * @param from - Source unit: raw or xno
 * @param to - Target unit: raw or xno
 * @returns Converted amount as string
 */
export function convertUnits(amount: string | number, from: string, to: string): string {
  const f = from.toLowerCase();
  const t = to.toLowerCase();

  // Coerce before the pass-through below, so raw -> raw still yields a string.
  // An unsupported `from` keeps the number as-is and throws in the switch below,
  // exactly as a string did.
  const value: string =
    typeof amount === 'number'
      ? f === 'raw'
        ? coerceRawNumber(amount, 'convertUnits')
        : f === 'xno'
          ? coerceXnoNumber(amount, 'convertUnits')
          : String(amount)
      : amount;

  if (f === t) return value;

  // Step 1: Convert from → raw
  let raw: string;
  switch (f) {
    case 'raw':
      raw = value;
      break;
    case 'xno':
      raw = nanoToRaw(value);
      break;
    default:
      throw new Error(`Unsupported unit: ${from}`);
  }

  // Step 2: Convert raw → to
  switch (t) {
    case 'raw':
      return raw;
    case 'xno':
      return rawToNano(raw);
    default:
      throw new Error(`Unsupported unit: ${to}`);
  }
}
