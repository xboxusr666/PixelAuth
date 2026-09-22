/**
 * PixelAuth - Cryptography Utilities
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Implements client-side AES-GCM-256 encryption and PBKDF2-SHA256
 * key derivation via the native Web Crypto API.
 */

const PBKDF2_ITERATIONS = 150000;
const PBKDF2_HASH = 'SHA-256';
const AES_KEY_LENGTH = 256;
const IV_BYTE_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const SALT_BYTE_LENGTH = 16;
const SENTINEL_TEXT = 'PIXELAUTH_VAULT_VALID';

/**
 * Converts an ArrayBuffer or Uint8Array to a hexadecimal string.
 * @param {ArrayBuffer|Uint8Array} buffer 
 * @returns {string}
 */
export function bufferToHex(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Converts a hexadecimal string back into a Uint8Array.
 * @param {string} hex 
 * @returns {Uint8Array}
 */
export function hexToBuffer(hex) {
  if (!hex || hex.length % 2 !== 0) {
    throw new Error('Invalid hexadecimal string format');
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Generates cryptographically secure random bytes.
 * @param {number} length 
 * @returns {Uint8Array}
 */
export function generateRandomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Generates a RFC 4122 version 4 UUID.
 * @returns {string}
 */
export function generateUUID() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const bytes = generateRandomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  const hex = bufferToHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Derives an AES-GCM 256-bit CryptoKey from a user password and salt.
 * @param {string} password 
 * @param {Uint8Array} saltBytes 
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, saltBytes) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: PBKDF2_HASH
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an arbitrary object or string with a password using AES-GCM-256.
 * @param {any} data 
 * @param {string} password 
 * @param {string} [existingSaltHex] 
 * @returns {Promise<{ ciphertext: string, iv: string, salt: string, sentinel: string }>}
 */
export async function encryptData(data, password, existingSaltHex = null) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  const saltBytes = existingSaltHex ? hexToBuffer(existingSaltHex) : generateRandomBytes(SALT_BYTE_LENGTH);
  const ivBytes = generateRandomBytes(IV_BYTE_LENGTH);
  const key = await deriveKey(password, saltBytes);

  const encoder = new TextEncoder();
  const serialized = JSON.stringify(data);
  const plaintextBytes = encoder.encode(serialized);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    key,
    plaintextBytes
  );

  // Also encrypt sentinel string to serve as authentication check
  const sentinelBytes = encoder.encode(SENTINEL_TEXT);
  const sentinelIv = generateRandomBytes(IV_BYTE_LENGTH);
  const encryptedSentinel = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: sentinelIv
    },
    key,
    sentinelBytes
  );

  return {
    ciphertext: bufferToHex(encryptedBuffer),
    iv: bufferToHex(ivBytes),
    salt: bufferToHex(saltBytes),
    sentinel: bufferToHex(encryptedSentinel),
    sentinelIv: bufferToHex(sentinelIv)
  };
}

/**
 * Decrypts ciphertext with a password.
 * @param {string} ciphertextHex 
 * @param {string} ivHex 
 * @param {string} saltHex 
 * @param {string} password 
 * @returns {Promise<any>} The parsed decrypted data.
 */
export async function decryptData(ciphertextHex, ivHex, saltHex, password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }

  try {
    const saltBytes = hexToBuffer(saltHex);
    const ivBytes = hexToBuffer(ivHex);
    const cipherBytes = hexToBuffer(ciphertextHex);

    const key = await deriveKey(password, saltBytes);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes
      },
      key,
      cipherBytes
    );

    const decoder = new TextDecoder();
    const jsonStr = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonStr);
  } catch (err) {
    throw new Error('Decryption failed. Incorrect master password or corrupted vault.');
  }
}

/**
 * Fast verification of a password against the vault sentinel without decrypting whole vault.
 * @param {string} sentinelHex 
 * @param {string} sentinelIvHex 
 * @param {string} saltHex 
 * @param {string} password 
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(sentinelHex, sentinelIvHex, saltHex, password) {
  try {
    const saltBytes = hexToBuffer(saltHex);
    const ivBytes = hexToBuffer(sentinelIvHex);
    const cipherBytes = hexToBuffer(sentinelHex);

    const key = await deriveKey(password, saltBytes);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes
      },
      key,
      cipherBytes
    );

    const decoder = new TextDecoder();
    const result = decoder.decode(decryptedBuffer);
    return result === SENTINEL_TEXT;
  } catch {
    return false;
  }
}
