/**
 * PixelAuth - Popup UI Controller
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Coordinates vault state, real-time OTP countdown rendering,
 * on-page screen snipping, QR decoding, and multi-app imports/exports.
 */

import { VaultManager } from '../core/vault/vault-manager.js';
import { generateTOTP, getTimeMetrics, parseOtpauthUri, formatOtpauthUri } from '../core/totp/otp.js';
import { scanImageForQR } from '../core/qr/scanner.js';
import { QRCodeGenerator } from '../core/qr/qr-generator.js';
import { parseImportData } from '../core/migration/importers.js';
import { exportEncryptedBackup, exportPlainBackup, exportUriList, triggerFileDownload } from '../core/migration/exporters.js';

const vaultManager = new VaultManager();
let otpInterval = null;
let currentSearchQuery = '';
let selectedAccountId = null;
let pendingImportContent = null;

// DOM Elements
const views = {
  setup: document.getElementById('view-setup'),
  unlock: document.getElementById('view-unlock'),
  main: document.getElementById('view-main')
};

const modals = {
  add: document.getElementById('modal-add'),
  settings: document.getElementById('modal-settings'),
  detail: document.getElementById('modal-detail'),
  pasteImport: document.getElementById('modal-paste-import'),
  changePassword: document.getElementById('modal-change-password')
};

const toastEl = document.getElementById('toast');
let toastTimer = null;

/**
 * Displays a non-blocking toast notification.
 * @param {string} message 
 * @param {number} [duration=2500] 
 */
function showToast(message, duration = 2500) {
  if (toastTimer) clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  toastTimer = setTimeout(() => {
    toastEl.classList.add('hidden');
  }, duration);
}

/**
 * Switches the primary view visible to the user.
 * @param {'setup'|'unlock'|'main'} viewName 
 */
function showView(viewName) {
  Object.keys(views).forEach(k => {
    if (k === viewName) {
      views[k].classList.remove('hidden');
    } else {
      views[k].classList.add('hidden');
    }
  });
}

/**
 * Opens a modal dialog.
 * @param {HTMLElement} modalEl 
 */
function openModal(modalEl) {
  modalEl.classList.remove('hidden');
}

/**
 * Closes a modal dialog.
 * @param {HTMLElement} modalEl 
 */
function closeModal(modalEl) {
  modalEl.classList.add('hidden');
}

/**
 * Applies color theme to body.
 * @param {string} themeClass 
 */
function applyTheme(themeClass) {
  let normalized = themeClass || 'theme-pixel-emerald';
  if (!normalized.startsWith('theme-')) {
    normalized = `theme-${normalized}`;
  }
  document.body.className = normalized;
}

/**
 * Formats a 6 or 8 digit OTP with a space for readability.
 * e.g. "123456" -> "123 456", "12345678" -> "1234 5678"
 * @param {string} code 
 * @returns {string}
 */
function formatOtpDisplay(code) {
  if (!code) return '------';
  if (code.length === 6) {
    return `${code.slice(0, 3)} ${code.slice(3)}`;
  }
  if (code.length === 8) {
    return `${code.slice(0, 4)} ${code.slice(4)}`;
  }
  return code;
}

/**
 * Renders the accounts list in the main view.
 */
async function renderAccounts() {
  const container = document.getElementById('accounts-container');
  const emptyState = document.getElementById('empty-state');
  const accounts = vaultManager.getAccounts();

  // Filter and sort accounts
  let filtered = accounts.filter(acc => {
    if (!currentSearchQuery) return true;
    const query = currentSearchQuery.toLowerCase();
    return (
      (acc.issuer && acc.issuer.toLowerCase().includes(query)) ||
      (acc.account && acc.account.toLowerCase().includes(query))
    );
  });

  // Sort: Favorites first, then alphabetical by issuer/account
  filtered.sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    const nameA = `${a.issuer} ${a.account}`.toLowerCase();
    const nameB = `${b.issuer} ${b.account}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = '';

  const now = Date.now();

  for (const acc of filtered) {
    const card = document.createElement('div');
    card.className = 'account-card';
    card.dataset.id = acc.id;

    // Generate live OTP code
    let code = '------';
    try {
      code = await generateTOTP(acc.secret, {
        period: acc.period || 30,
        digits: acc.digits || 6,
        algorithm: acc.algorithm || 'SHA-1',
        timestamp: now
      });
    } catch (err) {
      console.error('Error generating code for account:', acc.issuer, err);
      code = 'ERR';
    }

    const { remaining, progress } = getTimeMetrics(acc.period || 30, now);
    const isUrgent = remaining <= 5;

    card.innerHTML = `
      <div class="card-top">
        <div>
          <div class="issuer-name">${escapeHtml(acc.issuer || 'Unknown Service')}</div>
          <div class="account-label">${escapeHtml(acc.account || '')}</div>
        </div>
        <div class="card-actions">
          <button class="card-action-btn favorite ${acc.favorite ? 'active' : ''}" title="Favorite" data-action="favorite">
            ${acc.favorite ? '&#9733;' : '&#9734;'}
          </button>
          <button class="card-action-btn" title="Show QR / Details" data-action="details">
            &#128269;
          </button>
        </div>
      </div>
      <div class="card-code-row">
        <div class="otp-code">${formatOtpDisplay(code)}</div>
        <div class="timer-indicator">
          <span class="timer-text ${isUrgent ? 'urgent' : ''}">${remaining}s</span>
          <div class="timer-bar-bg">
            <div class="timer-bar-fill ${isUrgent ? 'urgent' : ''}" style="width: ${Math.round(progress * 100)}%;"></div>
          </div>
        </div>
      </div>
    `;

    // Click card to copy code
    card.addEventListener('click', async (e) => {
      if (e.target.closest('.card-action-btn')) return; // Ignore action buttons
      await copyAccountCode(code, acc.issuer);
      card.style.transform = 'scale(0.98)';
      setTimeout(() => card.style.transform = '', 150);
    });

    // Handle card actions
    const favBtn = card.querySelector('[data-action="favorite"]');
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await vaultManager.updateAccount(acc.id, { favorite: !acc.favorite });
      await renderAccounts();
    });

    const detailBtn = card.querySelector('[data-action="details"]');
    detailBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAccountDetails(acc);
    });

    container.appendChild(card);
  }
}

/**
 * Copies OTP code to clipboard and shows feedback.
 * @param {string} code 
 * @param {string} issuer 
 */
async function copyAccountCode(code, issuer) {
  if (!code || code === '------' || code === 'ERR') return;
  try {
    await navigator.clipboard.writeText(code);
    showToast(`Copied ${issuer ? issuer + ' ' : ''}code: ${code}`);
  } catch {
    showToast(`Code: ${code}`);
  }
}

/**
 * Starts the live countdown and code refresh ticker.
 */
function startOtpTicker() {
  if (otpInterval) clearInterval(otpInterval);
  otpInterval = setInterval(async () => {
    if (!views.main.classList.contains('hidden')) {
      await renderAccounts();
      await vaultManager.touchActivity();
    }
  }, 1000);
}

/**
 * Opens the account detail modal with canvas QR code.
 * @param {object} account 
 */
function openAccountDetails(account) {
  selectedAccountId = account.id;
  document.getElementById('detail-title').textContent = account.issuer || 'Account';
  document.getElementById('detail-issuer').textContent = account.issuer || '-';
  document.getElementById('detail-account').textContent = account.account || '-';
  document.getElementById('detail-secret').textContent = account.secret || '-';
  document.getElementById('detail-algo').textContent = `${account.algorithm || 'SHA-1'} (${account.digits || 6} digits, ${account.period || 30}s)`;

  // Render QR Code onto canvas
  const canvas = document.getElementById('detail-qr-canvas');
  const uri = formatOtpauthUri(account);
  QRCodeGenerator.renderToCanvas(canvas, uri, { scale: 5, margin: 2 });

  openModal(modals.detail);
}

/**
 * Helper to escape HTML tags.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Checks for any pending QR scans passed by the service worker or context menu.
 */
async function checkPendingScans() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'PIXELAUTH_GET_PENDING_SCANS' });
    if (response && response.success && response.pending && response.pending.length > 0) {
      const banner = document.getElementById('pending-scans-banner');
      const addBtn = document.getElementById('btn-import-pending');
      banner.classList.remove('hidden');

      addBtn.onclick = async () => {
        banner.classList.add('hidden');
        for (const item of response.pending) {
          try {
            const entry = parseOtpauthUri(item.uri);
            await vaultManager.addAccount(entry);
          } catch (err) {
            console.error('Error importing pending scan URI:', err);
          }
        }
        showToast(`Added ${response.pending.length} account(s)!`);
        await renderAccounts();
      };
    }
  } catch (err) {
    console.warn('Pending scans check error:', err);
  }
}

/* ==========================================================================
   Event Listeners & Initialization
   ========================================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Check vault status
  const initialized = await vaultManager.isInitialized();
  if (!initialized) {
    showView('setup');
    return;
  }

  const unlocked = await vaultManager.isUnlocked();
  if (unlocked) {
    const settings = vaultManager.getSettings();
    applyTheme(settings.theme);
    showView('main');
    await renderAccounts();
    startOtpTicker();
    await checkPendingScans();
  } else {
    showView('unlock');
  }
});

// Setup Master Password Form
document.getElementById('form-setup').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pwd = document.getElementById('setup-password').value;
  const confirm = document.getElementById('setup-confirm').value;
  const sessionUnlock = document.getElementById('setup-session-unlock').checked;

  if (pwd !== confirm) {
    alert('Passwords do not match. Please re-enter.');
    return;
  }

  try {
    await vaultManager.initialize(pwd, { sessionUnlock });
    showToast('Vault created successfully!');
    showView('main');
    await renderAccounts();
    startOtpTicker();
  } catch (err) {
    alert('Error initializing vault: ' + err.message);
  }
});

// Unlock Form
document.getElementById('form-unlock').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pwd = document.getElementById('unlock-password').value;
  const sessionUnlock = document.getElementById('unlock-session-unlock').checked;
  const errBox = document.getElementById('unlock-error');

  try {
    errBox.classList.add('hidden');
    await vaultManager.unlock(pwd);

    if (sessionUnlock !== undefined) {
      await vaultManager.updateSettings({ sessionUnlock });
    }

    const settings = vaultManager.getSettings();
    applyTheme(settings.theme);

    showView('main');
    await renderAccounts();
    startOtpTicker();
    await checkPendingScans();
  } catch (err) {
    errBox.textContent = err.message;
    errBox.classList.remove('hidden');
  }
});

// Header Buttons
document.getElementById('btn-header-lock').addEventListener('click', async () => {
  if (otpInterval) clearInterval(otpInterval);
  await vaultManager.lock();
  document.getElementById('unlock-password').value = '';
  showView('unlock');
  showToast('Vault Locked');
});

document.getElementById('btn-header-add').addEventListener('click', () => {
  openModal(modals.add);
});

document.getElementById('btn-empty-add').addEventListener('click', () => {
  openModal(modals.add);
});

document.getElementById('btn-header-settings').addEventListener('click', () => {
  const settings = vaultManager.getSettings();
  document.getElementById('setting-session-unlock').checked = !!settings.sessionUnlock;
  document.getElementById('setting-auto-lock').value = settings.autoLockMinutes || '0';
  document.getElementById('setting-theme').value = settings.theme || 'theme-pixel-emerald';
  openModal(modals.settings);
});

// Search Input
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('btn-clear-search');

searchInput.addEventListener('input', async (e) => {
  currentSearchQuery = e.target.value.trim();
  if (currentSearchQuery) {
    clearSearchBtn.classList.remove('hidden');
  } else {
    clearSearchBtn.classList.add('hidden');
  }
  await renderAccounts();
});

clearSearchBtn.addEventListener('click', async () => {
  searchInput.value = '';
  currentSearchQuery = '';
  clearSearchBtn.classList.add('hidden');
  await renderAccounts();
});

// Modal Close Buttons
document.getElementById('btn-close-add').addEventListener('click', () => closeModal(modals.add));
document.getElementById('btn-close-settings').addEventListener('click', () => closeModal(modals.settings));
document.getElementById('btn-close-detail').addEventListener('click', () => closeModal(modals.detail));
document.getElementById('btn-close-paste-import').addEventListener('click', () => closeModal(modals.pasteImport));
document.getElementById('btn-close-change-pwd').addEventListener('click', () => closeModal(modals.changePassword));

// Close any open modal on Escape key
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    Object.values(modals).forEach(m => closeModal(m));
  }
});

// Add Modal Tabs
document.querySelectorAll('.modal-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modal-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.modal-body .tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Settings Modal Tabs
document.querySelectorAll('.settings-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Tab 1: On-Page Screen Snip
document.getElementById('btn-trigger-screen-snip').addEventListener('click', async () => {
  try {
    const res = await chrome.runtime.sendMessage({ action: 'PIXELAUTH_TRIGGER_ONPAGE_SCAN' });
    if (res && res.success) {
      window.close(); // Close popup so user can immediately snip on the page
    } else {
      alert('Could not trigger screen snip on this page: ' + (res ? res.error : 'Unknown error'));
    }
  } catch (err) {
    alert('Failed to launch on-page snip: ' + err.message);
  }
});

// Tab 2: File Drop & Upload QR
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-qr-upload');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    await handleQRFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    await handleQRFile(e.target.files[0]);
  }
});

async function handleQRFile(file) {
  try {
    showToast('Scanning QR code image...');
    const text = await scanImageForQR(file);
    if (text.startsWith('otpauth://')) {
      const entry = parseOtpauthUri(text);
      await vaultManager.addAccount(entry);
      closeModal(modals.add);
      showToast(`Added ${entry.issuer || 'account'}!`);
      await renderAccounts();
    } else if (text.startsWith('otpauth-migration://')) {
      const { accounts } = await parseImportData(text);
      for (const acc of accounts) {
        await vaultManager.addAccount(acc);
      }
      closeModal(modals.add);
      showToast(`Imported ${accounts.length} Google Auth account(s)!`);
      await renderAccounts();
    } else {
      alert('Decoded QR text is not a valid 2FA authenticator code: ' + text);
    }
  } catch (err) {
    alert('QR scanning failed: ' + err.message);
  }
}

// Tab 3: Manual Entry Form
document.getElementById('form-manual-add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const entry = {
    issuer: document.getElementById('manual-issuer').value,
    account: document.getElementById('manual-account').value,
    secret: document.getElementById('manual-secret').value,
    type: document.getElementById('manual-type').value,
    digits: parseInt(document.getElementById('manual-digits').value, 10),
    period: parseInt(document.getElementById('manual-period').value, 10),
    algorithm: document.getElementById('manual-algo').value
  };

  try {
    await vaultManager.addAccount(entry);
    closeModal(modals.add);
    document.getElementById('form-manual-add').reset();
    showToast('Account added successfully!');
    await renderAccounts();
  } catch (err) {
    alert('Error adding account: ' + err.message);
  }
});

// Settings Changes
document.getElementById('setting-session-unlock').addEventListener('change', async (e) => {
  await vaultManager.updateSettings({ sessionUnlock: e.target.checked });
  showToast(e.target.checked ? 'Session unlock enabled' : 'Session unlock disabled');
});

document.getElementById('setting-auto-lock').addEventListener('change', async (e) => {
  const val = parseInt(e.target.value, 10);
  await vaultManager.updateSettings({ autoLockMinutes: val });
  showToast('Auto-lock settings updated');
});

document.getElementById('setting-theme').addEventListener('change', async (e) => {
  const theme = e.target.value;
  applyTheme(theme);
  await vaultManager.updateSettings({ theme });
});

// Change Password Trigger
document.getElementById('btn-change-password-modal').addEventListener('click', () => {
  closeModal(modals.settings);
  openModal(modals.changePassword);
});

document.getElementById('form-change-password').addEventListener('submit', async (e) => {
  e.preventDefault();
  const curr = document.getElementById('cp-current').value;
  const newPwd = document.getElementById('cp-new').value;
  const confirmPwd = document.getElementById('cp-confirm').value;

  if (newPwd !== confirmPwd) {
    alert('New passwords do not match.');
    return;
  }

  try {
    await vaultManager.changePassword(curr, newPwd);
    closeModal(modals.changePassword);
    document.getElementById('form-change-password').reset();
    showToast('Master password updated!');
  } catch (err) {
    alert('Password change failed: ' + err.message);
  }
});

// Detail Modal Actions
document.getElementById('btn-copy-uri').addEventListener('click', async () => {
  if (!selectedAccountId) return;
  const acc = vaultManager.getAccounts().find(a => a.id === selectedAccountId);
  if (acc) {
    const uri = formatOtpauthUri(acc);
    await navigator.clipboard.writeText(uri);
    showToast('URI copied to clipboard!');
  }
});

document.getElementById('btn-delete-account').addEventListener('click', async () => {
  if (!selectedAccountId) return;
  if (confirm('Are you sure you want to delete this MFA account? This cannot be undone.')) {
    await vaultManager.deleteAccount(selectedAccountId);
    closeModal(modals.detail);
    showToast('Account deleted');
    await renderAccounts();
  }
});

// Exports
document.getElementById('btn-export-encrypted').addEventListener('click', async () => {
  const pwd = prompt('Enter a password to encrypt your backup file (minimum 6 characters):');
  if (!pwd) return;
  if (pwd.length < 6) {
    alert('Password must be at least 6 characters long.');
    return;
  }
  try {
    const accounts = vaultManager.getAccounts();
    const backupJson = await exportEncryptedBackup(accounts, pwd);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerFileDownload(`pixelauth-backup-encrypted-${dateStr}.json`, backupJson);
    showToast('Encrypted backup exported!');
  } catch (err) {
    alert('Export failed: ' + err.message);
  }
});

document.getElementById('btn-export-plain').addEventListener('click', () => {
  if (confirm('Warning: Plain backups contain unencrypted 2FA secrets. Keep this file safe. Continue?')) {
    const accounts = vaultManager.getAccounts();
    const jsonStr = exportPlainBackup(accounts);
    const dateStr = new Date().toISOString().slice(0, 10);
    triggerFileDownload(`pixelauth-backup-${dateStr}.json`, jsonStr);
    showToast('Plain JSON backup exported!');
  }
});

document.getElementById('btn-export-uris').addEventListener('click', () => {
  const accounts = vaultManager.getAccounts();
  const uriList = exportUriList(accounts);
  const dateStr = new Date().toISOString().slice(0, 10);
  triggerFileDownload(`pixelauth-uris-${dateStr}.txt`, uriList, 'text/plain');
  showToast('URI list exported!');
});

// Imports
const fileImportInput = document.getElementById('file-import-input');
document.getElementById('btn-import-file').addEventListener('click', () => {
  fileImportInput.click();
});

fileImportInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    const file = e.target.files[0];
    const text = await file.text();
    await processImportText(text);
    fileImportInput.value = '';
  }
});

document.getElementById('btn-import-text').addEventListener('click', () => {
  closeModal(modals.settings);
  openModal(modals.pasteImport);
});

document.getElementById('btn-submit-paste-import').addEventListener('click', async () => {
  const text = document.getElementById('paste-import-textarea').value;
  const pwd = document.getElementById('import-backup-password').value;
  await processImportText(text, pwd);
});

async function processImportText(rawContent, backupPassword = '') {
  try {
    const { format, accounts } = await parseImportData(rawContent, backupPassword);
    if (!accounts || accounts.length === 0) {
      alert('No valid MFA accounts found in import data.');
      return;
    }

    for (const acc of accounts) {
      await vaultManager.addAccount(acc);
    }

    closeModal(modals.pasteImport);
    closeModal(modals.settings);
    document.getElementById('paste-import-textarea').value = '';
    document.getElementById('import-backup-password').value = '';
    document.getElementById('import-password-container').classList.add('hidden');

    showToast(`Imported ${accounts.length} account(s) from ${format}!`);
    await renderAccounts();
  } catch (err) {
    if (err.message === 'ENCRYPTED_BACKUP_PASSWORD_REQUIRED') {
      document.getElementById('import-password-container').classList.remove('hidden');
      alert('This is an encrypted backup. Please enter the decryption password below and click Process Import.');
    } else {
      alert('Import failed: ' + err.message);
    }
  }
}
