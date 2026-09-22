/**
 * PixelAuth - Vault Manager
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Manages encrypted vault persistence (chrome.storage.local),
 * ephemeral session unlock (chrome.storage.session),
 * account CRUD operations, and vault lifecycle.
 */

import { encryptData, decryptData, verifyPassword, generateUUID } from '../crypto/crypto-utils.js';

const STORAGE_KEYS = {
  VAULT_RECORD: 'pixelauth_vault_record',
  SESSION_CACHE: 'pixelauth_session_cache',
  LAST_ACTIVE: 'pixelauth_last_active'
};

const DEFAULT_SETTINGS = {
  sessionUnlock: true,         // Option to disable password prompt during browser session
  autoLockMinutes: 0,          // 0 = browser close only; >0 = timeout in minutes
  theme: 'theme-pixel-emerald',// 'theme-pixel-emerald', 'theme-cyber-blue', 'theme-retro-amber', 'theme-dark-slate'
  sortBy: 'manual',            // 'manual', 'issuer', 'account', 'recent'
  alwaysShowCountdown: true,   // Show remaining seconds as numbers
  hideCodesOnOpen: false       // Mask OTP codes until hovered/clicked
};

export class VaultManager {
  constructor() {
    this._cachedVault = null;
    this._activePassword = null;
  }

  /**
   * Checks whether a vault has been created.
   * @returns {Promise<boolean>}
   */
  async isInitialized() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.VAULT_RECORD);
    return !!result[STORAGE_KEYS.VAULT_RECORD];
  }

  /**
   * Checks whether the vault is currently unlocked (either in-memory or in session storage).
   * @returns {Promise<boolean>}
   */
  async isUnlocked() {
    if (this._cachedVault && this._activePassword) {
      return true;
    }

    // Check chrome.storage.session for session unlock bypass
    try {
      if (chrome.storage.session) {
        const session = await chrome.storage.session.get([
          STORAGE_KEYS.SESSION_CACHE,
          STORAGE_KEYS.LAST_ACTIVE
        ]);
        const sessionData = session[STORAGE_KEYS.SESSION_CACHE];

        if (sessionData && sessionData.vault && sessionData.password) {
          // Check auto-lock expiration if set
          const lastActive = session[STORAGE_KEYS.LAST_ACTIVE] || Date.now();
          const autoLockMinutes = sessionData.vault.settings?.autoLockMinutes || 0;

          if (autoLockMinutes > 0) {
            const elapsedMinutes = (Date.now() - lastActive) / (1000 * 60);
            if (elapsedMinutes >= autoLockMinutes) {
              await this.lock();
              return false;
            }
          }

          this._cachedVault = sessionData.vault;
          this._activePassword = sessionData.password;
          await this.touchActivity();
          return true;
        }
      }
    } catch (err) {
      console.warn('Session storage read error:', err);
    }

    return false;
  }

  /**
   * Records current timestamp to track activity for auto-lock timeouts.
   */
  async touchActivity() {
    try {
      if (chrome.storage.session) {
        await chrome.storage.session.set({ [STORAGE_KEYS.LAST_ACTIVE]: Date.now() });
      }
    } catch {
      // Ignored if session storage is unavailable
    }
  }

  /**
   * Initializes a new vault with a master password.
   * @param {string} masterPassword 
   * @param {object} [customSettings] 
   * @returns {Promise<void>}
   */
  async initialize(masterPassword, customSettings = {}) {
    if (!masterPassword || masterPassword.length < 6) {
      throw new Error('Master password must be at least 6 characters long.');
    }

    const initialVault = {
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: { ...DEFAULT_SETTINGS, ...customSettings },
      accounts: []
    };

    const record = await encryptData(initialVault, masterPassword);

    await chrome.storage.local.set({
      [STORAGE_KEYS.VAULT_RECORD]: record
    });

    this._cachedVault = initialVault;
    this._activePassword = masterPassword;

    if (initialVault.settings.sessionUnlock && chrome.storage.session) {
      await chrome.storage.session.set({
        [STORAGE_KEYS.SESSION_CACHE]: {
          vault: initialVault,
          password: masterPassword
        },
        [STORAGE_KEYS.LAST_ACTIVE]: Date.now()
      });
    }
  }

  /**
   * Unlocks the vault using the master password.
   * @param {string} masterPassword 
   * @returns {Promise<object>} The decrypted vault payload.
   */
  async unlock(masterPassword) {
    const local = await chrome.storage.local.get(STORAGE_KEYS.VAULT_RECORD);
    const record = local[STORAGE_KEYS.VAULT_RECORD];

    if (!record) {
      throw new Error('No vault found. Please create a master password first.');
    }

    // Decrypt data with master password
    const decryptedVault = await decryptData(
      record.ciphertext,
      record.iv,
      record.salt,
      masterPassword
    );

    // Merge default settings if new settings exist in newer versions
    decryptedVault.settings = { ...DEFAULT_SETTINGS, ...(decryptedVault.settings || {}) };

    this._cachedVault = decryptedVault;
    this._activePassword = masterPassword;

    // If session unlock is enabled, persist in chrome.storage.session
    if (decryptedVault.settings.sessionUnlock && chrome.storage.session) {
      await chrome.storage.session.set({
        [STORAGE_KEYS.SESSION_CACHE]: {
          vault: decryptedVault,
          password: masterPassword
        },
        [STORAGE_KEYS.LAST_ACTIVE]: Date.now()
      });
    }

    return decryptedVault;
  }

  /**
   * Locks the vault immediately, wiping in-memory data and session cache.
   * @returns {Promise<void>}
   */
  async lock() {
    this._cachedVault = null;
    this._activePassword = null;

    try {
      if (chrome.storage.session) {
        await chrome.storage.session.remove([
          STORAGE_KEYS.SESSION_CACHE,
          STORAGE_KEYS.LAST_ACTIVE
        ]);
      }
    } catch {
      // Session storage cleanup fallback
    }
  }

  /**
   * Gets current active vault data. Throws if locked.
   * @returns {object}
   */
  getVault() {
    if (!this._cachedVault) {
      throw new Error('Vault is locked. Please authenticate first.');
    }
    return this._cachedVault;
  }

  /**
   * Returns accounts list.
   * @returns {Array<object>}
   */
  getAccounts() {
    const vault = this.getVault();
    return vault.accounts || [];
  }

  /**
   * Returns vault settings.
   * @returns {object}
   */
  getSettings() {
    const vault = this.getVault();
    const settings = vault.settings || { ...DEFAULT_SETTINGS };
    if (settings.theme && !settings.theme.startsWith('theme-')) {
      settings.theme = `theme-${settings.theme}`;
    }
    return settings;
  }

  /**
   * Encrypts and persists updated vault state to local and session storage.
   * @returns {Promise<void>}
   */
  async save() {
    if (!this._cachedVault || !this._activePassword) {
      throw new Error('Cannot save vault: Vault is not unlocked.');
    }

    this._cachedVault.updatedAt = Date.now();

    // Re-encrypt with active password
    const record = await encryptData(this._cachedVault, this._activePassword);

    await chrome.storage.local.set({
      [STORAGE_KEYS.VAULT_RECORD]: record
    });

    // Update session storage if session unlock is enabled
    if (this._cachedVault.settings?.sessionUnlock && chrome.storage.session) {
      await chrome.storage.session.set({
        [STORAGE_KEYS.SESSION_CACHE]: {
          vault: this._cachedVault,
          password: this._activePassword
        },
        [STORAGE_KEYS.LAST_ACTIVE]: Date.now()
      });
    }
  }

  /**
   * Changes the master password. Re-encrypts the vault with the new password.
   * @param {string} currentPassword 
   * @param {string} newPassword 
   * @returns {Promise<void>}
   */
  async changePassword(currentPassword, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New master password must be at least 6 characters long.');
    }

    const local = await chrome.storage.local.get(STORAGE_KEYS.VAULT_RECORD);
    const record = local[STORAGE_KEYS.VAULT_RECORD];

    if (!record) {
      throw new Error('Vault does not exist.');
    }

    // Verify current password by decrypting
    const vault = await decryptData(
      record.ciphertext,
      record.iv,
      record.salt,
      currentPassword
    );

    this._cachedVault = vault;
    this._activePassword = newPassword;

    // Encrypt with fresh random salt and new password
    const newRecord = await encryptData(vault, newPassword);

    await chrome.storage.local.set({
      [STORAGE_KEYS.VAULT_RECORD]: newRecord
    });

    if (vault.settings?.sessionUnlock && chrome.storage.session) {
      await chrome.storage.session.set({
        [STORAGE_KEYS.SESSION_CACHE]: {
          vault,
          password: newPassword
        },
        [STORAGE_KEYS.LAST_ACTIVE]: Date.now()
      });
    }
  }

  /**
   * Adds an MFA account entry to the vault.
   * @param {object} entry 
   * @returns {Promise<object>} The newly created account entry.
   */
  async addAccount(entry) {
    const vault = this.getVault();

    const newAccount = {
      id: entry.id || generateUUID(),
      issuer: (entry.issuer || '').trim(),
      account: (entry.account || '').trim(),
      secret: (entry.secret || '').replace(/\s+/g, '').toUpperCase(),
      type: (entry.type || 'totp').toLowerCase(),
      algorithm: (entry.algorithm || 'SHA-1').toUpperCase(),
      digits: parseInt(entry.digits, 10) || 6,
      period: parseInt(entry.period, 10) || 30,
      counter: parseInt(entry.counter, 10) || 0,
      favorite: !!entry.favorite,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (!newAccount.secret) {
      throw new Error('Secret key is required.');
    }

    vault.accounts.push(newAccount);
    await this.save();
    return newAccount;
  }

  /**
   * Updates an existing account entry.
   * @param {string} id 
   * @param {object} updates 
   * @returns {Promise<object>}
   */
  async updateAccount(id, updates) {
    const vault = this.getVault();
    const index = vault.accounts.findIndex(a => a.id === id);

    if (index === -1) {
      throw new Error('Account not found in vault.');
    }

    const current = vault.accounts[index];
    const updated = {
      ...current,
      ...updates,
      updatedAt: Date.now()
    };

    if (updates.secret) {
      updated.secret = updates.secret.replace(/\s+/g, '').toUpperCase();
    }
    if (updates.issuer !== undefined) {
      updated.issuer = updates.issuer.trim();
    }
    if (updates.account !== undefined) {
      updated.account = updates.account.trim();
    }

    vault.accounts[index] = updated;
    await this.save();
    return updated;
  }

  /**
   * Deletes an account entry by ID.
   * @param {string} id 
   * @returns {Promise<void>}
   */
  async deleteAccount(id) {
    const vault = this.getVault();
    vault.accounts = vault.accounts.filter(a => a.id !== id);
    await this.save();
  }

  /**
   * Updates vault user preferences and settings.
   * @param {object} settingsUpdate 
   * @returns {Promise<object>}
   */
  async updateSettings(settingsUpdate) {
    const vault = this.getVault();
    vault.settings = { ...vault.settings, ...settingsUpdate };

    // If session unlock was toggled off, clear session cache immediately
    if (settingsUpdate.sessionUnlock === false && chrome.storage.session) {
      await chrome.storage.session.remove([
        STORAGE_KEYS.SESSION_CACHE,
        STORAGE_KEYS.LAST_ACTIVE
      ]);
    }

    await this.save();
    return vault.settings;
  }

  /**
   * Completely resets the vault (destroys all local records and caches).
   * @returns {Promise<void>}
   */
  async destroyVault() {
    this._cachedVault = null;
    this._activePassword = null;
    await chrome.storage.local.remove(STORAGE_KEYS.VAULT_RECORD);
    if (chrome.storage.session) {
      await chrome.storage.session.remove([
        STORAGE_KEYS.SESSION_CACHE,
        STORAGE_KEYS.LAST_ACTIVE
      ]);
    }
  }
}
