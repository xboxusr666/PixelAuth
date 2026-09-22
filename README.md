# PixelAuth - MFA Authenticator Wallet

```text
  ██████╗ ██╗██╗  ██╗███████╗██╗      █████╗ ██╗   ██╗████████╗██╗  ██╗
  ██╔══██╗██║╚██╗██╔╝██╔════╝██║     ██╔══██╗██║   ██║╚══██╔══╝██║  ██║
  ██████╔╝██║ ╚███╔╝ █████╗  ██║     ███████║██║   ██║   ██║   ███████║
  ██╔═══╝ ██║ ██╔██╗ ██╔══╝  ██║     ██╔══██║██║   ██║   ██║   ██╔══██║
  ██║     ██║██╔╝ ██╗███████╗███████╗██║  ██║╚██████╔╝   ██║   ██║  ██║
  ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝
```

> **A secure, open-source MFA wallet Chrome extension with on-page QR scanning, encrypted storage, session unlock, and cross-app import/export.**  
> *Developed by JTS Software | Licensed under GNU General Public License v3.0 (GPL-3.0)*

---

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-success.svg)](manifest.json)
[![Zero Network Calls](https://img.shields.io/badge/Network-100%25%20Offline-brightgreen.svg)](#security--privacy)
[![Crypto](https://img.shields.io/badge/Encryption-AES--256--GCM%20%2B%20PBKDF2-orange.svg)](#cryptography-architecture)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Security & Cryptography](#security--cryptography)
- [Installation](#installation)
  - [Load Unpacked in Google Chrome](#load-unpacked-in-google-chrome)
  - [Creating a Production CRX/ZIP](#creating-a-production-crxzip)
- [Usage Guide](#usage-guide)
  - [First-Time Setup](#first-time-setup)
  - [Adding Accounts via On-Page QR Snip](#adding-accounts-via-on-page-qr-snip)
  - [Right-Click Context Menu Scanning](#right-click-context-menu-scanning)
  - [Manual Entry & File Drag-and-Drop](#manual-entry--file-drag-and-drop)
  - [Session Unlock Bypass & Auto-Lock](#session-unlock-bypass--auto-lock)
  - [Exporting & Displaying QR Codes](#exporting--displaying-qr-codes)
  - [Cross-App Migration (Google Auth, Aegis, 2FAS, Bitwarden)](#cross-app-migration)
- [Themes & Customization](#themes--customization)
- [Project Architecture](#project-architecture)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**PixelAuth** is a privacy-first, zero-knowledge authenticator extension built for Google Chrome. Unlike mobile-only authenticator apps that require you to pick up your phone every time you log in, PixelAuth brings seamless two-factor authentication directly into your browser workflow while maintaining enterprise-grade cryptography.

PixelAuth operates **100% locally and offline**. It makes zero outbound network calls, collects zero telemetry, and stores all 2FA secrets in an AES-256-GCM encrypted vault derived from your personal master password using 150,000 rounds of PBKDF2-SHA256.

---

## Key Features

- **On-Page QR Code Screen Snip**: Drag a marquee box over any QR code displayed on any web page to scan and add it instantly—no webcam or external app needed.
- **Right-Click Context Menu**: Right-click on any QR code image on the web and select *"Scan QR code with PixelAuth"*.
- **Drag-and-Drop QR Upload**: Drag QR code images, screenshots, or receipts directly into the popup.
- **Manual Key Entry**: Full support for entering Base32 secrets manually, with support for TOTP (time-based) and HOTP (counter-based) algorithms (SHA-1, SHA-256, SHA-512) and 6 or 8 digits.
- **Master Password Protection**: Client-side AES-256-GCM encryption ensures your 2FA secrets are completely safe even if physical or local disk access occurs.
- **Session Unlock Bypass**: Don't want to re-type your master password every time you open the popup? Enable *"Keep unlocked during browser session"*, which holds the decrypted vault safely in ephemeral session storage (`chrome.storage.session`) until Chrome closes.
- **Configurable Auto-Lock**: Set inactivity timeouts (5m, 15m, 30m, 1h, or browser close only).
- **Cross-App Migration**:
  - **Google Authenticator**: Decodes `otpauth-migration://offline?data=...` export QR codes using an integrated Protocol Buffer parser.
  - **Aegis Authenticator**: Full Aegis JSON backup import support.
  - **2FAS Authenticator**: Imports 2FAS backup format.
  - **Bitwarden**: Imports standard Bitwarden vault export MFA keys.
  - **Standard URI Lists**: Imports and exports standard `otpauth://` multi-line text files.
  - **PixelAuth Backups**: Exports password-encrypted JSON or plain JSON backups.
- **Mobile QR Code Generator**: Renders pixel-crisp QR codes on canvas for any stored account so you can easily scan codes back into mobile authenticator apps.
- **Retro-Pixel Aesthetics**: Retro computer design with pixelated borders, multiple neon/CRT themes (Pixel Emerald, Cyber Blue, Retro Amber, Dark Slate), live countdown progress bars, and one-click clipboard copying.

---

## Security & Cryptography

```text
+-------------------+      PBKDF2-SHA256       +---------------------+
|  Master Password  | -----------------------> | 256-bit AES-GCM Key |
+-------------------+   (150,000 iterations)   +---------------------+
                                                          |
                                                          v
+-------------------+        AES-256-GCM       +---------------------+
| Plaintext Vault   | -----------------------> | Ciphertext + Auth   |
| (Secrets, Labels) |    (12-byte random IV)   | (Storage / Backup)  |
+-------------------+                          +---------------------+
```

- **Encryption**: AES-GCM with 256-bit keys and 12-byte cryptographically secure random IVs (`crypto.getRandomValues`).
- **Key Derivation**: PBKDF2 with SHA-256 and 150,000 iterations with unique 16-byte random salts per vault.
- **Integrity**: AES-GCM 128-bit authentication tags prevent tampering or bit-flipping attacks.
- **Session Security**: Ephemeral session caching utilizes `chrome.storage.session`, which is stored in browser memory only, is isolated from web pages and content scripts, and is destroyed immediately when the browser exits.
- **Zero Network Transmission**: The extension has no background server connections, no analytics, no CDNs, and no external dependencies.

---

## Installation

### Load Unpacked in Google Chrome

1. Clone or download this repository:
   ```bash
   git clone https://github.com/xboxusr666/PixelAuth.git
   ```
2. Open Google Chrome and navigate to:
   ```text
   chrome://extensions
   ```
3. In the top-right corner, toggle **Developer mode** ON.
4. Click **Load unpacked** in the top-left corner.
5. Select the repository folder (the folder containing `manifest.json`).
6. The PixelAuth icon will appear in your Chrome toolbar. Click the puzzle icon to pin it for quick access!

### Creating a Production CRX/ZIP

To create a distributable zip archive:
```bash
# Using zip utility
zip -r pixelauth-extension.zip manifest.json assets/ src/ LICENSE README.md PRIVACY.md
```

Or run the automated GitHub Actions workflow on tag release.

---

## Usage Guide

### First-Time Setup

1. Click the PixelAuth icon in your Chrome toolbar.
2. Enter your chosen **Master Password** (minimum 6 characters).
3. Toggle *"Keep unlocked during browser session"* if you want to avoid re-entering your password while your browser is open.
4. Click **CREATE ENCRYPTED VAULT**.

### Adding Accounts via On-Page QR Snip

1. Navigate to any website setting up 2FA (e.g. GitHub, Google, Amazon).
2. Click the PixelAuth icon and click the **+** (Add Account) button.
3. In the **Scan Screen** tab, click **LAUNCH ON-PAGE SNIP**.
4. The popup closes and an overlay appears on the page. Drag a rectangle over the QR code on the webpage (or click directly on the QR image).
5. PixelAuth will capture, crop, and decode the QR code, alerting you via notification. Click the PixelAuth icon to confirm and save!

### Right-Click Context Menu Scanning

1. When viewing a QR code image on any webpage, right-click the image.
2. Select **Scan QR code with PixelAuth**.
3. A notification will appear confirming the scan. Open PixelAuth to add the account.

### Manual Entry & File Drag-and-Drop

- **Manual Entry**: Click **+** -> **Manual**, enter the service name, username, and Base32 secret key.
- **Upload Image**: Click **+** -> **Upload QR**, drag a screenshot or image of a QR code into the box.

### Cross-App Migration

- **Importing from Google Authenticator**:
  1. Open Google Authenticator on your phone -> *Transfer accounts* -> *Export accounts*.
  2. Take a screenshot or scan the migration QR code using PixelAuth's screen snip or image upload.
  3. PixelAuth's built-in Protocol Buffer decoder will parse all exported accounts at once!
- **Importing from Aegis / 2FAS / Bitwarden**:
  1. Go to **Settings** (gear icon) -> **Backup** tab -> **Select File to Import**.
  2. Select your exported `.json` or `.txt` file.

### Exporting & Displaying QR Codes

- **Individual Account QR Code**: Click the magnifying glass icon on any account card to open its detail modal. A canvas QR code is displayed, allowing you to scan it directly with your phone's camera!
- **Encrypted Full Backup**: Go to **Settings** -> **Backup** -> **Encrypted Backup (.json)** to generate a password-protected JSON backup file.

---

## Themes & Customization

PixelAuth includes four built-in color schemes inspired by classic computing:
- **Pixel Emerald** (Default): Retro terminal green and deep slate.
- **Cyber Blue**: Vibrant cyberpunk cyan and neon purple accents.
- **Retro Amber**: Warm CRT phosphor monitor styling.
- **Dark Slate**: Clean, high-contrast modern minimalist dark mode.

Change themes anytime in **Settings** -> **Security** -> **Color Theme**.

---

## Project Architecture

```text
PixelAuth/
├── manifest.json                  # Manifest V3 extension configuration
├── LICENSE                        # GNU General Public License v3.0
├── README.md                      # Documentation & user manual
├── PRIVACY.md                     # Zero-telemetry offline privacy statement
├── CHROMEWEBSTORE.md              # Chrome Web Store listing metadata & justifications
├── CONTRIBUTING.md                # Open-source contribution guidelines
├── SECURITY.md                    # Security disclosure policy
├── .gitignore                     # Repository exclusions
├── .github/
│   ├── workflows/ci.yml           # Automated CI lint, test, and release packaging
│   └── ISSUE_TEMPLATE/            # Bug report and feature request templates
├── assets/
│   ├── icons/                     # Pixel-art PNG icons (16, 32, 48, 128px)
│   └── promo/                     # Web store banner & marquee graphics
├── tools/
│   ├── generate_assets.py         # Pillow asset generator script
│   └── test_totp_vectors.py       # RFC 6238 / RFC 4226 test suite
└── src/
    ├── background/
    │   └── service-worker.js      # Background service worker (menus, capture, alarms)
    ├── content/
    │   ├── scanner-overlay.js     # On-page interactive screen snip content script
    │   └── scanner-overlay.css    # Screen snip overlay styling
    ├── core/
    │   ├── crypto/
    │   │   └── crypto-utils.js    # AES-256-GCM + PBKDF2 Web Crypto implementation
    │   ├── vault/
    │   │   └── vault-manager.js   # Encrypted storage & session unlock manager
    │   ├── totp/
    │   │   ├── base32.js          # RFC 4648 Base32 encoder/decoder
    │   │   └── otp.js             # RFC 6238 TOTP / RFC 4226 HOTP calculations
    │   ├── qr/
    │   │   ├── jsqr.js            # Pure JS QR code locator and decoder
    │   │   ├── qr-generator.js    # Canvas-based QR code generator
    │   │   └── scanner.js         # Multi-pass image and BarcodeDetector scanner
    │   └── migration/
    │       ├── protobuf-decoder.js# Google Authenticator migration protobuf parser
    │       ├── importers.js       # Multi-format import engine
    │       └── exporters.js       # Encrypted/plain backup export engine
    └── popup/
        ├── popup.html             # Popup layout and modal dialogs
        ├── popup.css              # Retro pixel-art stylesheet
        └── popup.js               # Reactive UI controller and timer loop
```

---

## Contributing

Contributions are welcome! Please review [CONTRIBUTING.md](CONTRIBUTING.md) for details on code style, testing, and pull request procedures.

---

## License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.  
See the [LICENSE](LICENSE) file for the full license text.

Copyright &copy; 2026 **JTS Software**.
