# Changelog

All notable changes to **PixelAuth** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-22

### Added
- **Manifest V3 Core**: Clean, modular Chrome Extension architecture adhering to the latest Google Chrome Manifest V3 specifications.
- **Client-Side Cryptography**:
  - AES-256-GCM encrypted vault persistence.
  - PBKDF2-SHA256 key derivation with 150,000 iterations and 16-byte random salts.
  - Verification canary authentication check.
- **Session Password Bypass**:
  - Optional session unlock caching in `chrome.storage.session` (memory-only, destroyed on browser exit).
  - Configurable inactivity auto-lock timeouts (5m, 15m, 30m, 1h, or browser exit).
  - Instant manual lock button.
- **On-Page Screen Snip & QR Scanning**:
  - Interactive marquee overlay on web pages allowing selection of any QR code on screen.
  - Single-click detection of `<img>` and `<canvas>` elements on webpages.
  - Right-click context menu: *"Scan QR code with PixelAuth"*.
  - File drag-and-drop and image upload QR decoder.
- **Multi-App Import & Export**:
  - Google Authenticator `otpauth-migration://offline?data=...` Protocol Buffer wire-format decoder.
  - Aegis Authenticator JSON import.
  - 2FAS Authenticator JSON import.
  - Bitwarden MFA key import.
  - Standard `otpauth://` multi-line URI list import & export.
  - Password-encrypted JSON backup export and restore.
  - Plain JSON backup export.
- **On-Demand QR Code Display**:
  - Canvas-based QR code generator to display any account's 2FA secret on screen for scanning back into mobile authenticators.
- **Retro-Pixel Art Design**:
  - Crisp pixel-art UI with high-contrast monospace code display and live circular/linear countdown progress bars.
  - Four customizable color themes: Pixel Emerald, Cyber Blue, Retro Amber, and Dark Slate.
- **Open-Source Repository Infrastructure**:
  - GNU General Public License v3.0 (`LICENSE`).
  - Comprehensive documentation (`README.md`, `PRIVACY.md`, `CHROMEWEBSTORE.md`, `CONTRIBUTING.md`, `SECURITY.md`).
  - GitHub Actions CI workflow for validation, tests, and release zip packaging.
  - Pixel-art PNG icons at 16, 32, 48, and 128 px, plus promotional banners.
