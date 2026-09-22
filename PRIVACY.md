# Privacy Policy for PixelAuth

**Last Updated:** 2026-09-22  
**Developer:** JTS Software  
**Product:** PixelAuth - MFA Authenticator Wallet  

---

## 1. Introduction

PixelAuth is an open-source two-factor authentication (2FA) extension built for the Google Chrome browser. Your privacy and security are paramount. This policy clearly outlines how PixelAuth handles your data.

## 2. Zero Data Collection & Telemetry

PixelAuth adheres to a strict **zero-telemetry, zero-data-collection** policy:

- **No Remote Servers:** PixelAuth does not communicate with any external servers, APIs, or cloud services.
- **No Analytics or Tracking:** PixelAuth contains no tracking scripts, beacons, telemetry tools, or advertising libraries.
- **No Personal Information:** PixelAuth does not collect names, email addresses, browsing history, IP addresses, or device identifiers.

## 3. Data Storage & Cryptography

- **Local Storage Only:** All your 2FA accounts, labels, and secret keys are stored entirely within your browser's local device storage (`chrome.storage.local`).
- **Client-Side Encryption:** When protected by a master password, all secrets are encrypted using the native Web Crypto API with AES-256-GCM and a key derived via PBKDF2-SHA256 (150,000 rounds). Decryption occurs exclusively in your local browser memory.
- **Session Memory:** If you choose to enable the *"Keep unlocked during browser session"* setting, the temporary session key is placed in Chrome's memory-only session storage (`chrome.storage.session`). This storage is isolated from web pages and is wiped immediately when your browser is closed.

## 4. Permissions Usage

PixelAuth requests only the minimal permissions necessary to function:
- **`storage`**: To store your encrypted wallet locally on your device.
- **`activeTab` & `scripting`**: Used only when you trigger on-page QR scanning to display the selection overlay on the current tab. PixelAuth does not record or monitor your browsing activity.
- **`contextMenus`**: To add the right-click option for scanning QR code images.
- **`clipboardWrite`**: To allow copying one-time passcodes with a single click.
- **`notifications`**: To confirm when a QR code has been decoded.

## 5. Third-Party Sharing

Because PixelAuth collects no data, no information is ever sold, rented, shared, or transferred to any third party.

## 6. Open-Source Transparency

PixelAuth is free and open-source software licensed under the GNU General Public License v3.0 (GPL-3.0). The complete source code is publicly inspectable and verifiable.

---

*For inquiries or security advisories, please open an issue or security report on the official GitHub repository.*
