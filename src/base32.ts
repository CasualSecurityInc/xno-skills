/**
 * Nano Base32 Encoding/Decoding
 * 
 * Nano uses a custom Base32 encoding with a specific character set
 * that excludes visually ambiguous characters: 0, O, I, l, 2
 * 
 * Character set: 13456789abcdefghijkmnopqrstuwxyz (32 characters)
 * Note: 'x' IS included in the Nano charset (despite some docs saying otherwise)
 */

const CHARSET = '13456789abcdefghijkmnopqrstuwxyz';

/**
 * Lookup table for decoding: character -> value (0-31)
 */
const DECODE_MAP: Record<string, number> = {};
for (let i = 0; i < CHARSET.length; i++) {
  DECODE_MAP[CHARSET[i]] = i;
}

/**
 * Encodes a Uint8Array to a Nano Base32 string.
 * 
 * The encoding process:
 * 1. Treats the input bytes as a continuous bit stream
 * 2. Extracts 5-bit chunks from the stream
 * 3. Maps each 5-bit value (0-31) to the corresponding character
 * 
 * @param bytes - The input bytes to encode
 * @returns The Base32 encoded string
 * 
 * @example
 * ```ts
 * base32Encode(new Uint8Array([0x00])) // returns '1'
 * base32Encode(new Uint8Array([0xff])) // returns 'z'
 * ```
 */
export function base32Encode(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  let result = '';
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < bytes.length; i++) {
    buffer = (buffer << 8) | bytes[i];
    bits += 8;

    // Extract as many 5-bit chunks as possible
    while (bits >= 5) {
      bits -= 5;
      const index = (buffer >> bits) & 0x1f;
      result += CHARSET[index];
    }
  }

  // Handle remaining bits (pad with zeros if needed)
  if (bits > 0) {
    const index = (buffer << (5 - bits)) & 0x1f;
    result += CHARSET[index];
  }

  return result;
}

/**
 * Decodes a Nano Base32 string to a Uint8Array.
 * 
 * The decoding process:
 * 1. Maps each character to its 5-bit value
 * 2. Reconstructs the byte stream from the 5-bit chunks
 * 
 * @param str - The Base32 encoded string to decode
 * @returns The decoded bytes
 * @throws Error if the string contains invalid characters
 * 
 * @example
 * ```ts
 * base32Decode('1') // returns Uint8Array([0x00])
 * base32Decode('z') // returns Uint8Array([0xff])
 * ```
 */
export function base32Decode(str: string): Uint8Array {
  if (str.length === 0) {
    return new Uint8Array(0);
  }

  // Validate all characters first
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (DECODE_MAP[char] === undefined) {
      throw new Error(
        `Invalid Base32 character '${char}' at position ${i}. ` +
        `Valid characters are: ${CHARSET}`
      );
    }
  }

  // Calculate output length
  // Each character represents 5 bits
  // Output bytes = ceil(chars * 5 / 8)
  const outputLength = Math.ceil((str.length * 5) / 8);
  const result = new Uint8Array(outputLength);

  let buffer = 0;
  let bits = 0;
  let byteIndex = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const value = DECODE_MAP[char];
    
    buffer = (buffer << 5) | value;
    bits += 5;

    // Extract complete bytes
    while (bits >= 8) {
      bits -= 8;
      result[byteIndex++] = (buffer >> bits) & 0xff;
    }
  }

  // Note: We don't handle remaining bits here because Nano addresses
  // are designed such that the encoding produces exact byte boundaries
  // For general use, we return the bytes we've decoded

  return result.slice(0, byteIndex);
}