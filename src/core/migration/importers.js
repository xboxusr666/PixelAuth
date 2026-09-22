/**
 * PixelAuth - Multi-Format Importers
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Imports MFA entries from Google Authenticator, Aegis, 2FAS,
 * Bitwarden, standard otpauth:// lists, and PixelAuth backups.
 */

import { parseOtpauthUri } from '../totp/otp.js';
import { decodeGoogleAuthMigration } from './protobuf-decoder.js';
import { decryptData } from '../crypto/crypto-utils.js';

/**
 * Autodetects and parses MFA accounts from raw text/file content.
 * @param {string} rawContent 
 * @param {string} [backupPassword] 
 * @returns {Promise<{ format: string, accounts: Array<object> }>}
 */
export async function parseImportData(rawContent, backupPassword = '') {
  const trimmed = (rawContent || '').trim();
  if (!trimmed) {
    throw new Error('Import content is empty.');
  }

  // 1. Check for Google Authenticator migration URI
  if (trimmed.startsWith('otpauth-migration://')) {
    const accounts = decodeGoogleAuthMigration(trimmed);
    return { format: 'Google Authenticator', accounts };
  }

  // 2. Check for single otpauth:// URI or multi-line URI list
  if (trimmed.startsWith('otpauth://') || trimmed.includes('\notpauth://') || trimmed.includes('\rotpauth://')) {
    const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(l => l.startsWith('otpauth://'));
    const accounts = [];
    for (const line of lines) {
      try {
        accounts.push(parseOtpauthUri(line));
      } catch (err) {
        console.warn('Skipping invalid otpauth URI:', line, err);
      }
    }
    if (accounts.length > 0) {
      return { format: 'URI List', accounts };
    }
  }

  // 3. Try parsing as JSON
  try {
    const json = JSON.parse(trimmed);

    // 3a. PixelAuth Encrypted Backup
    if (json.pixelauth_backup && json.encrypted) {
      if (!backupPassword) {
        throw new Error('ENCRYPTED_BACKUP_PASSWORD_REQUIRED');
      }
      const decrypted = await decryptData(
        json.ciphertext,
        json.iv,
        json.salt,
        backupPassword
      );
      if (!decrypted || !Array.isArray(decrypted.accounts)) {
        throw new Error('Invalid backup structure after decryption.');
      }
      return { format: 'PixelAuth Encrypted Backup', accounts: decrypted.accounts };
    }

    // 3b. PixelAuth Plain JSON Backup
    if (json.pixelauth_backup && Array.isArray(json.accounts)) {
      return { format: 'PixelAuth Plain Backup', accounts: json.accounts };
    }

    // 3c. Aegis Authenticator Export
    if (json.db && Array.isArray(json.db.entries)) {
      const accounts = [];
      for (const entry of json.db.entries) {
        if (entry.info && entry.info.secret) {
          accounts.push({
            issuer: entry.issuer || entry.name || 'Aegis',
            account: entry.name || 'Account',
            secret: entry.info.secret.replace(/\s+/g, '').toUpperCase(),
            type: (entry.type || 'totp').toLowerCase(),
            algorithm: (entry.info.algo || 'SHA1').toUpperCase().replace('SHA1', 'SHA-1'),
            digits: entry.info.digits || 6,
            period: entry.info.period || 30,
            counter: entry.info.counter || 0,
            favorite: false
          });
        }
      }
      return { format: 'Aegis Authenticator', accounts };
    }

    // 3d. 2FAS Authenticator Export
    if (Array.isArray(json.services) || (json.schemaVersion && Array.isArray(json.services))) {
      const accounts = [];
      for (const s of json.services) {
        if (s.secret) {
          accounts.push({
            issuer: s.name || '2FAS',
            account: (s.otp && s.otp.account) || s.name || 'Account',
            secret: s.secret.replace(/\s+/g, '').toUpperCase(),
            type: (s.otp && s.otp.tokenType ? s.otp.tokenType.toLowerCase() : 'totp'),
            algorithm: (s.otp && s.otp.algorithm ? s.otp.algorithm.toUpperCase().replace('SHA1', 'SHA-1') : 'SHA-1'),
            digits: (s.otp && s.otp.digits) || 6,
            period: (s.otp && s.otp.period) || 30,
            counter: (s.otp && s.otp.counter) || 0,
            favorite: false
          });
        }
      }
      return { format: '2FAS Authenticator', accounts };
    }

    // 3e. Bitwarden Export
    if (Array.isArray(json.items)) {
      const accounts = [];
      for (const item of json.items) {
        const totpUri = item.login && item.login.totp;
        if (totpUri) {
          try {
            if (totpUri.startsWith('otpauth://')) {
              accounts.push(parseOtpauthUri(totpUri));
            } else {
              // Raw secret key
              accounts.push({
                issuer: item.name || 'Bitwarden',
                account: (item.login && item.login.username) || item.name || 'Account',
                secret: totpUri.replace(/\s+/g, '').toUpperCase(),
                type: 'totp',
                algorithm: 'SHA-1',
                digits: 6,
                period: 30
              });
            }
          } catch (e) {
            console.warn('Failed parsing Bitwarden TOTP item:', item.name, e);
          }
        }
      }
      if (accounts.length > 0) {
        return { format: 'Bitwarden', accounts };
      }
    }

    // 3f. Generic array of accounts
    if (Array.isArray(json)) {
      const accounts = json.filter(a => a && a.secret);
      if (accounts.length > 0) {
        return { format: 'Generic JSON', accounts };
      }
    }

  } catch (err) {
    if (err.message === 'ENCRYPTED_BACKUP_PASSWORD_REQUIRED') {
      throw err;
    }
    // Fall through to error
  }

  throw new Error('Unrecognized or invalid MFA import format.');
}
