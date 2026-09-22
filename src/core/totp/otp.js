/**
 * PixelAuth - TOTP & HOTP Generation Engine (RFC 6238 & RFC 4226)
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Uses the Web Crypto API (crypto.subtle) for zero-dependency,
 * hardware-accelerated HMAC-SHA1, HMAC-SHA256, and HMAC-SHA512.
 */

import { base32Decode } from './base32.js';

const ALGORITHM_MAP = {
  'SHA-1': 'SHA-1',
  'SHA1': 'SHA-1',
  'SHA-256': 'SHA-256',
  'SHA256': 'SHA-256',
  'SHA-512': 'SHA-512',
  'SHA512': 'SHA-512'
};

/**
 * Generates an 8-byte big-endian ArrayBuffer for a counter value.
 * @param {number|bigint} counter 
 * @returns {ArrayBuffer}
 */
function counterToBuffer(counter) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const bigVal = BigInt(counter);
  view.setBigUint64(0, bigVal, false); // Big-endian
  return buffer;
}

/**
 * Generates an HMAC-based One-Time Password (RFC 4226).
 * @param {string} secretBase32 
 * @param {number} counter 
 * @param {number} [digits=6] 
 * @param {string} [algorithm='SHA-1'] 
 * @returns {Promise<string>} Formatted OTP code (e.g., "123456").
 */
export async function generateHOTP(secretBase32, counter, digits = 6, algorithm = 'SHA-1') {
  const normalizedAlgo = ALGORITHM_MAP[algorithm.toUpperCase()] || 'SHA-1';
  const keyBytes = base32Decode(secretBase32);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    {
      name: 'HMAC',
      hash: { name: normalizedAlgo }
    },
    false,
    ['sign']
  );

  const messageBuffer = counterToBuffer(counter);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageBuffer);
  const hmacResult = new Uint8Array(signature);

  // Dynamic truncation (RFC 4226 section 5.4)
  const offset = hmacResult[hmacResult.length - 1] & 0x0f;
  const binaryCode =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const modulus = 10 ** digits;
  const otpNumber = binaryCode % modulus;

  return otpNumber.toString().padStart(digits, '0');
}

/**
 * Generates a Time-based One-Time Password (RFC 6238).
 * @param {string} secretBase32 
 * @param {object} [options] 
 * @param {number} [options.period=30]
 * @param {number} [options.digits=6]
 * @param {string} [options.algorithm='SHA-1']
 * @param {number} [options.timestamp=Date.now()]
 * @returns {Promise<string>}
 */
export async function generateTOTP(secretBase32, options = {}) {
  const period = options.period || 30;
  const digits = options.digits || 6;
  const algorithm = options.algorithm || 'SHA-1';
  const timestamp = options.timestamp !== undefined ? options.timestamp : Date.now();

  const counter = Math.floor(timestamp / 1000 / period);
  return await generateHOTP(secretBase32, counter, digits, algorithm);
}

/**
 * Calculates time remaining and progress ratio in the current TOTP step.
 * @param {number} [period=30] 
 * @param {number} [timestamp=Date.now()] 
 * @returns {{ remaining: number, progress: number, epochSeconds: number }}
 */
export function getTimeMetrics(period = 30, timestamp = Date.now()) {
  const epochSeconds = Math.floor(timestamp / 1000);
  const stepTime = epochSeconds % period;
  const remaining = period - stepTime;
  const progress = remaining / period; // 1.0 (start) down to 0.0 (expire)

  return { remaining, progress, epochSeconds };
}

/**
 * Parses a standard otpauth:// URI.
 * Example: otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30
 * @param {string} uriString 
 * @returns {object}
 */
export function parseOtpauthUri(uriString) {
  if (!uriString || typeof uriString !== 'string' || !uriString.startsWith('otpauth://')) {
    throw new Error('Invalid OTP Auth URI scheme');
  }

  const url = new URL(uriString);
  const type = url.host.toLowerCase(); // 'totp' or 'hotp'
  if (type !== 'totp' && type !== 'hotp') {
    throw new Error(`Unsupported OTP type: ${type}`);
  }

  // Label format: /Issuer:account or /account
  let label = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  let issuer = url.searchParams.get('issuer') || '';
  let account = label;

  if (label.includes(':')) {
    const parts = label.split(':');
    if (!issuer) {
      issuer = parts[0].trim();
    }
    account = parts.slice(1).join(':').trim();
  }

  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('URI is missing required secret parameter');
  }

  const algorithm = (url.searchParams.get('algorithm') || 'SHA1').toUpperCase();
  const digits = parseInt(url.searchParams.get('digits') || '6', 10);
  const period = parseInt(url.searchParams.get('period') || '30', 10);
  const counter = parseInt(url.searchParams.get('counter') || '0', 10);

  return {
    type,
    issuer: issuer || 'Unknown',
    account: account || 'Account',
    secret: secret.replace(/\s+/g, '').toUpperCase(),
    algorithm: algorithm === 'SHA1' ? 'SHA-1' : algorithm,
    digits,
    period,
    counter
  };
}

/**
 * Formats an account entry into a standard otpauth:// URI.
 * @param {object} entry 
 * @returns {string}
 */
export function formatOtpauthUri(entry) {
  const type = (entry.type || 'totp').toLowerCase();
  const issuer = entry.issuer || '';
  const account = entry.account || '';

  let label = '';
  if (issuer && account) {
    label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  } else {
    label = encodeURIComponent(account || issuer || 'PixelAuth');
  }

  const params = new URLSearchParams();
  params.set('secret', entry.secret);
  if (issuer) params.set('issuer', issuer);
  
  const algo = (entry.algorithm || 'SHA-1').replace('-', '');
  if (algo !== 'SHA1') params.set('algorithm', algo);
  if (entry.digits && entry.digits !== 6) params.set('digits', entry.digits.toString());
  if (type === 'totp' && entry.period && entry.period !== 30) params.set('period', entry.period.toString());
  if (type === 'hotp') params.set('counter', (entry.counter || 0).toString());

  return `otpauth://${type}/${label}?${params.toString()}`;
}
