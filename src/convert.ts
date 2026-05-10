/**
 * Precise unit conversions for XNO (Nano) cryptocurrency using BigInt.
 * 
 * Units:
 * - raw: base unit (10^0)
 * - XNO (Nano): 10^30 raw
 * - knano: 10^27 raw (kilo-nano)
 * - mnano: 10^24 raw (mega-nano)
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
    decimal
  };
}

/**
 * Converts Nano (XNO) to raw units.
 * @param nano - Nano amount as string (supports decimals)
 * @returns Raw amount as string
 */
export function nanoToRaw(nano: string): string {
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
 * @param raw - Raw amount as string
 * @param decimals - Number of decimal places to return (default: 30)
 * @returns Nano amount as string
 */
export function rawToNano(raw: string, decimals: number = 30): string {
  if (!raw || raw === '') return '0';
  if (raw.startsWith('-')) throw new Error('rawToNano: negative values not supported');
  
  const { integer: intPart } = parseDecimal(raw);
  
  // Convert to BigInt first to handle the raw value
  const rawBigInt = BigInt(intPart);
  
  const nanoBigInt = rawBigInt / BigInt(10) ** NAN;
  const remainder = rawBigInt % BigInt(10) ** NAN;
  
  // Format with exact decimal places
  const remainderStr = remainder.toString().padStart(30, '0');
  const rawDecimalPart = remainderStr.slice(0, decimals);
  
  // Use default behavior (trim trailing zeros) when decimals=30
  const decimalPart = decimals === 30 
    ? rawDecimalPart.replace(/0+$/, '') 
    : rawDecimalPart.padEnd(decimals, '0');
  
  const intStr = nanoBigInt === 0n ? '0' : nanoBigInt.toString();
  const result = decimalPart ? `${intStr}.${decimalPart}` : intStr;
  
  return result;
}

/**
 * Formats raw units as Nano (XNO) with full 30 decimal precision.
 * @param raw - Raw amount as string
 * @returns Formatted Nano string
 */
export function formatNano(raw: string): string {
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
 * Converts raw units to knano.
 * @param raw - Raw amount as string
 * @returns knano amount as string
 */
export function rawToKnano(raw: string): string {
  if (!raw || raw === '') return '0';
  if (raw.startsWith('-')) throw new Error('rawToKnano: negative values not supported');

  const { integer: intPart } = parseDecimal(raw);
  const rawBigInt = BigInt(intPart);

  const knanoBigInt = rawBigInt / BigInt(10) ** 27n;
  const remainder = rawBigInt % BigInt(10) ** 27n;

  const remainderStr = remainder.toString().padStart(27, '0');
  const trimmedDecimals = remainderStr.replace(/0+$/, '');

  const intStr = knanoBigInt === 0n ? '0' : knanoBigInt.toString();
  return trimmedDecimals ? `${intStr}.${trimmedDecimals}` : intStr;
}

/**
 * Converts knano (kilo-nano) to raw units.
 * 1 knano = 10^27 raw
 * @param knano - knano amount as string
 * @returns Raw amount as string
 */
export function knanoToRaw(knano: string): string {
  if (!knano || knano === '') return '0';
  if (knano.startsWith('-')) throw new Error('knanoToRaw: negative values not supported');

  const { integer, decimal } = parseDecimal(knano);

  const scaledDecimal = decimal.slice(0, 27).padEnd(27, '0');
  const combined = integer + scaledDecimal;

  return stripLeadingZeros(BigInt(combined).toString());
}

/**
 * Converts raw units to mnano.
 * @param raw - Raw amount as string
 * @returns mnano amount as string
 */
export function rawToMnano(raw: string): string {
  if (!raw || raw === '') return '0';
  if (raw.startsWith('-')) throw new Error('rawToMnano: negative values not supported');

  const { integer: intPart } = parseDecimal(raw);
  const rawBigInt = BigInt(intPart);

  const mnanoBigInt = rawBigInt / BigInt(10) ** 24n;
  const remainder = rawBigInt % BigInt(10) ** 24n;

  const remainderStr = remainder.toString().padStart(24, '0');
  const trimmedDecimals = remainderStr.replace(/0+$/, '');

  const intStr = mnanoBigInt === 0n ? '0' : mnanoBigInt.toString();
  return trimmedDecimals ? `${intStr}.${trimmedDecimals}` : intStr;
}

/**
 * Converts mnano (mega-nano) to raw units.
 * 1 mnano = 10^24 raw
 * @param mnano - mnano amount as string
 * @returns Raw amount as string
 */
export function mnanoToRaw(mnano: string): string {
  if (!mnano || mnano === '') return '0';
  if (mnano.startsWith('-')) throw new Error('mnanoToRaw: negative values not supported');

  const { integer, decimal } = parseDecimal(mnano);

  const scaledDecimal = decimal.slice(0, 24).padEnd(24, '0');
  const combined = integer + scaledDecimal;

  return stripLeadingZeros(BigInt(combined).toString());
}

/**
 * General unit conversion: converts amount from one unit to another.
 * Supported units: raw, mnano, knano, xno
 * @param amount - Amount as string
 * @param from - Source unit
 * @param to - Target unit
 * @returns Converted amount as string
 */
export function convertUnits(amount: string, from: string, to: string): string {
  const f = from.toLowerCase();
  const t = to.toLowerCase();

  if (f === t) return amount;

  // Step 1: Convert from → raw
  let raw: string;
  switch (f) {
    case 'raw': raw = amount; break;
    case 'mnano': raw = mnanoToRaw(amount); break;
    case 'knano': raw = knanoToRaw(amount); break;
    case 'xno': raw = nanoToRaw(amount); break;
    default: throw new Error(`Unsupported unit: ${from}`);
  }

  // Step 2: Convert raw → to
  switch (t) {
    case 'raw': return raw;
    case 'mnano': return rawToMnano(raw);
    case 'knano': return rawToKnano(raw);
    case 'xno': return rawToNano(raw);
    default: throw new Error(`Unsupported unit: ${to}`);
  }
}
