/**
 * PixelAuth - Background Service Worker
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Handles context menus, screen capture cropping,
 * auto-lock alarms, and pending scan message dispatch.
 */

const CONTEXT_MENU_ID = 'pixelauth_scan_image';
const PENDING_SCAN_KEY = 'pixelauth_pending_scans';

// Setup Context Menus upon installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Scan QR code with PixelAuth',
    contexts: ['image']
  });
});

/**
 * Saves a decoded OTP URI into pending scans storage so the popup can consume it.
 * @param {string} otpUri 
 */
async function storePendingScan(otpUri) {
  const result = await chrome.storage.local.get(PENDING_SCAN_KEY);
  const pending = result[PENDING_SCAN_KEY] || [];
  pending.push({
    uri: otpUri,
    timestamp: Date.now()
  });
  await chrome.storage.local.set({ [PENDING_SCAN_KEY]: pending });

  // Update badge to alert user
  await chrome.action.setBadgeText({ text: '+' });
  await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
}

/**
 * Decodes a QR code directly from an ImageBitmap using BarcodeDetector.
 * @param {ImageBitmap} bitmap 
 * @returns {Promise<string|null>}
 */
async function decodeBitmapQR(bitmap) {
  if (typeof BarcodeDetector !== 'undefined') {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const results = await detector.detect(bitmap);
    if (results && results.length > 0) {
      return results[0].rawValue;
    }
  }
  return null;
}

// Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === CONTEXT_MENU_ID && info.srcUrl) {
    try {
      const response = await fetch(info.srcUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      const decodedText = await decodeBitmapQR(bitmap);

      if (decodedText && (decodedText.startsWith('otpauth://') || decodedText.startsWith('otpauth-migration://'))) {
        await storePendingScan(decodedText);
        // Show desktop notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
          title: 'PixelAuth - QR Code Detected',
          message: 'MFA account detected! Click the PixelAuth icon to save it into your wallet.'
        });
      } else {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
          title: 'PixelAuth Scan Failed',
          message: 'No valid OTP QR code was found in the selected image.'
        });
      }
    } catch (err) {
      console.error('Error scanning context menu image:', err);
      chrome.notifications.create({
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
        title: 'PixelAuth Error',
        message: 'Could not access or process the selected image.'
      });
    }
  }
});

// Message Listener for on-page scanning and screenshot cropping
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === 'PIXELAUTH_TRIGGER_ONPAGE_SCAN') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }

        // Inject overlay CSS and script into current active tab
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['src/content/scanner-overlay.css']
        });
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['src/content/scanner-overlay.js']
        });

        sendResponse({ success: true });
        return;
      }

      if (message.action === 'PIXELAUTH_PROCESS_SNIP_SELECTION') {
        const { crop } = message;
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });

        const res = await fetch(dataUrl);
        const blob = await res.blob();

        // Crop directly via createImageBitmap
        const bitmap = await createImageBitmap(blob, crop.x, crop.y, crop.width, crop.height);
        const decodedText = await decodeBitmapQR(bitmap);

        if (decodedText) {
          await storePendingScan(decodedText);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
            title: 'PixelAuth - QR Code Captured',
            message: 'MFA QR code scanned successfully! Open PixelAuth to add account.'
          });
          sendResponse({ success: true, uri: decodedText });
        } else {
          // Try full image if crop missed slightly
          const fullBitmap = await createImageBitmap(blob);
          const fullDecoded = await decodeBitmapQR(fullBitmap);
          if (fullDecoded) {
            await storePendingScan(fullDecoded);
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
              title: 'PixelAuth - QR Code Captured',
              message: 'MFA QR code scanned successfully! Open PixelAuth to add account.'
            });
            sendResponse({ success: true, uri: fullDecoded });
          } else {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
              title: 'PixelAuth - No QR Detected',
              message: 'Could not detect a valid QR code in the selected area.'
            });
            sendResponse({ success: false, error: 'No QR code detected' });
          }
        }
        return;
      }

      if (message.action === 'PIXELAUTH_PROCESS_IMAGE_URL') {
        const response = await fetch(message.imageUrl);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        const decodedText = await decodeBitmapQR(bitmap);

        if (decodedText) {
          await storePendingScan(decodedText);
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('assets/icons/icon-128.png'),
            title: 'PixelAuth - QR Code Captured',
            message: 'MFA account captured from image! Open PixelAuth to save.'
          });
          sendResponse({ success: true, uri: decodedText });
        } else {
          sendResponse({ success: false, error: 'No QR code detected in image' });
        }
        return;
      }

      if (message.action === 'PIXELAUTH_PROCESS_IMAGE_DATA_URL') {
        const res = await fetch(message.dataUrl);
        const blob = await res.blob();
        const bitmap = await createImageBitmap(blob);
        const decodedText = await decodeBitmapQR(bitmap);

        if (decodedText) {
          await storePendingScan(decodedText);
          sendResponse({ success: true, uri: decodedText });
        } else {
          sendResponse({ success: false, error: 'No QR code detected in canvas' });
        }
        return;
      }

      if (message.action === 'PIXELAUTH_GET_PENDING_SCANS') {
        const result = await chrome.storage.local.get(PENDING_SCAN_KEY);
        const pending = result[PENDING_SCAN_KEY] || [];
        // Clear pending scans once retrieved
        await chrome.storage.local.remove(PENDING_SCAN_KEY);
        await chrome.action.setBadgeText({ text: '' });
        sendResponse({ success: true, pending });
        return;
      }

      sendResponse({ success: false, error: 'Unknown action' });
    } catch (err) {
      console.error('Service worker message handling error:', err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // Keep channel open for async response
});
