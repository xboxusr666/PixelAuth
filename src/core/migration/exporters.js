/**
 * PixelAuth - Multi-Format Exporters
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Exports MFA entries to encrypted/plain JSON backups and standard URI text files.
 */

import { formatOtpauthUri } from '../totp/otp.js';
import { encryptData } from '../crypto/crypto-utils.js';

/**
 * Triggers a file download in the browser without requiring external permissions.
 * @param {string} filename 
 * @param {string} content 
 * @param {string} mimeType 
 */
export function triggerFileDownload(filename, content, mimeType = 'application/json') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exports vault accounts as a password-encrypted PixelAuth JSON backup file.
 * @param {Array<object>} accounts 
 * @param {string} backupPassword 
 * @returns {Promise<string>} JSON string of the backup.
 */
export async function exportEncryptedBackup(accounts, backupPassword) {
  if (!backupPassword || backupPassword.length < 6) {
    throw new Error('Backup password must be at least 6 characters long.');
  }

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: accounts || []
  };

  const encrypted = await encryptData(payload, backupPassword);

  const backupObject = {
    pixelauth_backup: true,
    encrypted: true,
    version: 1,
    exportedAt: payload.exportedAt,
    ciphertext: encrypted.ciphertext,
    iv: encrypted.iv,
    salt: encrypted.salt,
    sentinel: encrypted.sentinel,
    sentinelIv: encrypted.sentinelIv
  };

  return JSON.stringify(backupObject, null, 2);
}

/**
 * Exports vault accounts as an unencrypted plain JSON file.
 * @param {Array<object>} accounts 
 * @returns {string} JSON string.
 */
export function exportPlainBackup(accounts) {
  const backupObject = {
    pixelauth_backup: true,
    encrypted: false,
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: accounts || []
  };

  return JSON.stringify(backupObject, null, 2);
}

/**
 * Exports vault accounts as a standard list of otpauth:// URIs.
 * @param {Array<object>} accounts 
 * @returns {string} Multi-line string.
 */
export function exportUriList(accounts) {
  return (accounts || [])
    .map(acc => {
      try {
        return formatOtpauthUri(acc);
      } catch (err) {
        console.warn('Failed formatting URI for account:', acc.issuer, err);
        return null;
      }
    })
    .filter(Boolean)
    .join('\n');
}
