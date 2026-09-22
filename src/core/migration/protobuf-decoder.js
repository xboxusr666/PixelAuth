/**
 * PixelAuth - Google Authenticator Migration Protobuf Decoder
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Implements a pure-JS Protocol Buffer wire-format reader
 * specifically tailored for the Google Authenticator 'MigrationPayload' schema.
 */

import { base32Encode } from '../totp/base32.js';

class ProtobufReader {
  constructor(buffer) {
    this.buffer = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    this.offset = 0;
  }

  hasMore() {
    return this.offset < this.buffer.length;
  }

  readVarint() {
    let result = 0;
    let shift = 0;

    while (this.offset < this.buffer.length) {
      const byte = this.buffer[this.offset++];
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        return result;
      }
      shift += 7;
      if (shift > 35) {
        // Varint overflow guard
        return result;
      }
    }
    return result;
  }

  readBytes() {
    const length = this.readVarint();
    if (this.offset + length > this.buffer.length) {
      throw new Error('Protobuf length-delimited field exceeds buffer bounds');
    }
    const bytes = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return bytes;
  }

  readString() {
    const bytes = this.readBytes();
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(bytes);
  }

  skip(wireType) {
    switch (wireType) {
      case 0: // Varint
        this.readVarint();
        break;
      case 1: // 64-bit
        this.offset += 8;
        break;
      case 2: // Length-delimited
        const len = this.readVarint();
        this.offset += len;
        break;
      case 5: // 32-bit
        this.offset += 4;
        break;
      default:
        throw new Error(`Unsupported protobuf wire type: ${wireType}`);
    }
  }
}

/**
 * Decodes a single OtpParameters sub-message.
 * @param {Uint8Array} buffer 
 * @returns {object}
 */
function decodeOtpParameters(buffer) {
  const reader = new ProtobufReader(buffer);
  const entry = {
    secretBytes: null,
    name: '',
    issuer: '',
    algorithm: 'SHA-1',
    digits: 6,
    type: 'totp',
    counter: 0
  };

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    switch (fieldNumber) {
      case 1: // secret (bytes)
        entry.secretBytes = reader.readBytes();
        break;
      case 2: // name (string)
        entry.name = reader.readString();
        break;
      case 3: // issuer (string)
        entry.issuer = reader.readString();
        break;
      case 4: // algorithm (enum)
        const algoCode = reader.readVarint();
        if (algoCode === 2) entry.algorithm = 'SHA-256';
        else if (algoCode === 3) entry.algorithm = 'SHA-512';
        else entry.algorithm = 'SHA-1';
        break;
      case 5: // digits (enum)
        const digitCode = reader.readVarint();
        entry.digits = digitCode === 2 ? 8 : 6;
        break;
      case 6: // type (enum)
        const typeCode = reader.readVarint();
        entry.type = typeCode === 1 ? 'hotp' : 'totp';
        break;
      case 7: // counter (int64)
        entry.counter = reader.readVarint();
        break;
      default:
        reader.skip(wireType);
        break;
    }
  }

  // Convert raw secret bytes to standard Base32 string
  let secretBase32 = '';
  if (entry.secretBytes && entry.secretBytes.length > 0) {
    secretBase32 = base32Encode(entry.secretBytes, false);
  }

  let account = entry.name;
  let issuer = entry.issuer;
  if (entry.name && entry.name.includes(':')) {
    const parts = entry.name.split(':');
    if (!issuer) issuer = parts[0].trim();
    account = parts.slice(1).join(':').trim();
  }

  return {
    issuer: issuer || 'Google Authenticator',
    account: account || 'Account',
    secret: secretBase32,
    algorithm: entry.algorithm,
    digits: entry.digits,
    type: entry.type,
    period: 30,
    counter: entry.counter
  };
}

/**
 * Parses a Google Authenticator migration URI (otpauth-migration://offline?data=...).
 * @param {string} migrationUri 
 * @returns {Array<object>} Array of imported account configurations.
 */
export function decodeGoogleAuthMigration(migrationUri) {
  if (!migrationUri.startsWith('otpauth-migration://')) {
    throw new Error('URI is not a Google Authenticator migration payload.');
  }

  const url = new URL(migrationUri);
  const dataParam = url.searchParams.get('data');
  if (!dataParam) {
    throw new Error('Missing "data" parameter in migration URI.');
  }

  // Decode base64 payload
  const binaryString = atob(decodeURIComponent(dataParam));
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const reader = new ProtobufReader(bytes);
  const accounts = [];

  while (reader.hasMore()) {
    const tag = reader.readVarint();
    const fieldNumber = tag >> 3;
    const wireType = tag & 0x07;

    if (fieldNumber === 1 && wireType === 2) {
      // repeated OtpParameters otp_parameters = 1;
      const paramBytes = reader.readBytes();
      const account = decodeOtpParameters(paramBytes);
      if (account.secret) {
        accounts.push(account);
      }
    } else {
      reader.skip(wireType);
    }
  }

  return accounts;
}
