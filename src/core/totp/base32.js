/**
 * PixelAuth - Base32 (RFC 4648) Encoder and Decoder
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Implements strict and lenient RFC 4648 base32 decoding
 * with support for padding omission, spaces, and hyphens.
 */

const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Decodes a Base32 string to a Uint8Array.
 * @param {string} input 
 * @returns {Uint8Array}
 */
export function base32Decode(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Base32 input must be a non-empty string');
  }

  // Clean input: remove whitespace, hyphens, and padding
  const cleaned = input
    .toUpperCase()
    .replace(/[\s\-_=]/g, '');

  if (cleaned.length === 0) {
    return new Uint8Array(0);
  }

  // Map each character to 5-bit integer
  const bitLength = cleaned.length * 5;
  const byteLength = Math.floor(bitLength / 8);
  const result = new Uint8Array(byteLength);

  let currentBuffer = 0;
  let bitsInBuffer = 0;
  let byteIndex = 0;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    const val = RFC4648_ALPHABET.indexOf(char);

    if (val === -1) {
      throw new Error(`Invalid Base32 character encountered: '${char}'`);
    }

    currentBuffer = (currentBuffer << 5) | val;
    bitsInBuffer += 5;

    if (bitsInBuffer >= 8) {
      bitsInBuffer -= 8;
      result[byteIndex++] = (currentBuffer >> bitsInBuffer) & 0xff;
    }
  }

  return result;
}

/**
 * Encodes a Uint8Array or Buffer to a Base32 string.
 * @param {Uint8Array|ArrayBuffer} buffer 
 * @param {boolean} [pad=false] 
 * @returns {string}
 */
export function base32Encode(buffer, pad = false) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length === 0) {
    return '';
  }

  let result = '';
  let currentBuffer = 0;
  let bitsInBuffer = 0;

  for (let i = 0; i < bytes.length; i++) {
    currentBuffer = (currentBuffer << 8) | bytes[i];
    bitsInBuffer += 8;

    while (bitsInBuffer >= 5) {
      bitsInBuffer -= 5;
      const index = (currentBuffer >> bitsInBuffer) & 0x1f;
      result += RFC4648_ALPHABET[index];
    }
  }

  if (bitsInBuffer > 0) {
    const index = (currentBuffer << (5 - bitsInBuffer)) & 0x1f;
    result += RFC4648_ALPHABET[index];
  }

  if (pad) {
    while (result.length % 8 !== 0) {
      result += '=';
    }
  }

  return result;
}
