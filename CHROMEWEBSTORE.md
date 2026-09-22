# Chrome Web Store Listing: PixelAuth

**Last Updated:** 2026-09-22  
**Extension Name:** PixelAuth - MFA Authenticator Wallet  
**Developer:** JTS Software  
**Primary Category:** Productivity / Security  
**Language:** English  

---

## Store Listing Metadata

### Short Description (Max 132 characters)
Secure MFA authenticator wallet with on-page QR scanning, password encryption, session unlock, and multi-app import and export.

### Detailed Description

Protect your online accounts with PixelAuth, a fast, secure two-factor authentication (2FA) wallet designed directly for your browser. PixelAuth generates time-based and counter-based one-time passcodes (TOTP and HOTP) locally on your device with complete privacy.

KEY FEATURES:

* On-Page QR Code Snip: Add 2FA to your accounts without picking up your phone. Select any QR code directly on your screen to scan and add it instantly.
* Context Menu Scanning: Right-click any QR code image on the web to quickly add it to your wallet.
* Drag-and-Drop Image Upload: Upload saved QR images or screenshots from your computer.
* Password Protection: Protect all your authenticator keys behind a secure master password.
* Convenient Session Unlock: Avoid repeated password entries while browsing by keeping your wallet unlocked until you close your browser.
* Cross-App Migration: Effortlessly import existing 2FA accounts from Google Authenticator, Aegis, 2FAS, Bitwarden, and standard backup files.
* Offline & Private: 100% offline operation. PixelAuth does not connect to external servers, track your activity, or collect any personal data.
* Mobile Display: View on-screen QR codes for any account to easily transfer them back to mobile authenticator apps.
* Retro Pixel Aesthetics: Clean, high-contrast retro themes with intuitive countdown timers and one-click code copying.

---

## Permissions Justification

| Permission | Purpose & Plain-English Justification |
| :--- | :--- |
| `storage` | Required to save the user's encrypted 2FA vault in browser local storage and manage temporary session-unlock state in memory-only session storage. |
| `activeTab` | Required to capture the visible browser tab and display the selection overlay when the user explicitly clicks the "Snip Screen" button to scan an on-page 2FA QR code. |
| `scripting` | Required to inject the interactive marquee selection box into the current web page when the user initiates an on-page QR code scan. |
| `contextMenus` | Required to add the "Scan QR code with PixelAuth" right-click action on web images. |
| `clipboardWrite` | Required to allow the user to copy 2FA one-time passcodes directly to the clipboard with a single click. |
| `notifications` | Required to display a confirmation message when a 2FA QR code has been successfully scanned via the right-click menu or screen snip. |

---

## Host Permissions
*No host permissions requested. PixelAuth operates with strictly scoped `activeTab` access on explicit user action.*

---

## Single Purpose Description
PixelAuth serves the single purpose of generating, managing, and storing two-factor authentication (2FA) one-time passcodes locally in the browser with password protection and on-page QR scanning.

---

## Privacy & Data Use Disclosures

- **Data Collection:** Zero data collected. PixelAuth does not transmit, harvest, or log any data to external servers or third parties.
- **Data Storage:** All account secrets and labels are stored exclusively in the browser's local encrypted storage using client-side encryption.
- **Third-Party Services:** None. PixelAuth operates without external network requests or third-party analytics.

---

## Version History

- **v1.0.0** (2026-09-22)
  - Initial public open-source release.
  - Client-side AES-256-GCM vault encryption with PBKDF2-SHA256 (150,000 iterations).
  - On-page interactive QR code screen snip and element click detection.
  - Context menu QR code scanner.
  - Ephemeral session unlock and configurable auto-lock timeout.
  - Protocol Buffer Google Authenticator migration import support.
  - Multi-format import and export (Aegis, 2FAS, Bitwarden, URI lists, encrypted backups).
  - Four customizable retro pixel color themes.
