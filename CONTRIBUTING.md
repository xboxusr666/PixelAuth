# Contributing to PixelAuth

Thank you for your interest in contributing to **PixelAuth**, an open-source MFA Authenticator Wallet by **JTS Software**!

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**. By contributing, you agree that your contributions will be licensed under the same terms.

---

## Code of Conduct

We are committed to providing a welcoming, respectful, and harassment-free environment for everyone. Please be polite, constructive, and collaborative in all issues and pull requests.

---

## How to Contribute

### 1. Reporting Bugs
- Check the [GitHub Issues](https://github.com/xboxusr666/PixelAuth/issues) tracker to ensure the bug hasn't already been reported.
- If not, open a new issue using the **Bug Report** template.
- Include clear reproduction steps, browser version, and console error messages if applicable.
- **Never post your real 2FA secrets, private keys, or QR codes in issue descriptions.**

### 2. Suggesting Features
- Open a **Feature Request** issue describing the motivation and proposed behavior.
- Ensure suggested features align with PixelAuth's core principles: **100% offline, privacy-first, zero telemetry**.

### 3. Submitting Pull Requests

1. **Fork the Repository** and clone your fork locally:
   ```bash
   git clone https://github.com/xboxusr666/PixelAuth.git
   cd PixelAuth
   ```
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make Your Changes**:
   - Write clean, modular, modern vanilla JavaScript (ES modules).
   - Avoid introducing external runtime libraries or CDNs. PixelAuth must remain 100% offline.
   - Maintain the retro pixel-art aesthetic where appropriate.
4. **Test Your Changes**:
   - Load the unpacked extension in Chrome (`chrome://extensions`).
   - Verify encryption/decryption, OTP calculation, QR scanning, and multi-app imports.
   - Run the automated test script:
     ```bash
     python tools/test_totp_vectors.py
     ```
5. **Commit and Push**:
   ```bash
   git commit -m "Add feature description"
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request**:
   - Submit your PR against the `main` branch.
   - Provide a clear summary of changes and testing steps in the PR description.

---

## Coding Standards

- **Manifest V3 Only**: Never use deprecated MV2 patterns.
- **Async/Await**: Always use `async`/`await` instead of raw `.then()` chains.
- **No Global State in Service Workers**: Persist background state in `chrome.storage`.
- **Security First**: All cryptography must utilize standard Web Crypto API algorithms (`crypto.subtle`). Never invent custom ciphers.
