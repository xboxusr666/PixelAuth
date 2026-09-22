/**
 * PixelAuth - QR Code Scanner Engine
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Scans images, dropped files, tab screenshots, and screen regions
 * using Chrome's native BarcodeDetector API with contrast enhancement fallbacks.
 */

/**
 * Loads an image from a Data URL, Object URL, or Blob into an HTMLImageElement.
 * @param {string|Blob|File} source 
 * @returns {Promise<HTMLImageElement>}
 */
export function loadImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let urlToRevoke = null;
    if (source instanceof Blob || source instanceof File) {
      urlToRevoke = URL.createObjectURL(source);
      img.src = urlToRevoke;
    } else if (typeof source === 'string') {
      img.src = source;
    } else {
      reject(new Error('Unsupported image source type'));
      return;
    }

    img.onload = () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      resolve(img);
    };

    img.onerror = (err) => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      reject(new Error('Failed to load image for scanning'));
    };
  });
}

/**
 * Scans an ImageBitmap, HTMLCanvasElement, or HTMLImageElement for QR codes.
 * @param {CanvasImageSource} imageSource 
 * @returns {Promise<string|null>} Decoded QR content string, or null if not found.
 */
export async function detectQRCode(imageSource) {
  if (!('BarcodeDetector' in window)) {
    throw new Error('BarcodeDetector API is not supported in this browser version.');
  }

  try {
    const detector = new BarcodeDetector({ formats: ['qr_code'] });
    const results = await detector.detect(imageSource);

    if (results && results.length > 0) {
      return results[0].rawValue;
    }
  } catch (err) {
    console.warn('BarcodeDetector error:', err);
  }

  return null;
}

/**
 * Scans an image file or Data URL with multi-pass contrast adjustments.
 * @param {string|File|Blob} source 
 * @param {object} [cropBounds] Optional { x, y, width, height }
 * @returns {Promise<string>} The decoded QR code string (e.g. otpauth:// URI).
 */
export async function scanImageForQR(source, cropBounds = null) {
  const img = await loadImage(source);

  // Setup canvas
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const sx = cropBounds ? Math.max(0, cropBounds.x) : 0;
  const sy = cropBounds ? Math.max(0, cropBounds.y) : 0;
  const sWidth = cropBounds ? Math.min(cropBounds.width, img.naturalWidth - sx) : img.naturalWidth;
  const sHeight = cropBounds ? Math.min(cropBounds.height, img.naturalHeight - sy) : img.naturalHeight;

  canvas.width = sWidth;
  canvas.height = sHeight;

  // Pass 1: Original image / crop
  ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
  let result = await detectQRCode(canvas);
  if (result) return result;

  // Pass 2: Grayscale and high contrast
  const imgData = ctx.getImageData(0, 0, sWidth, sHeight);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    // Luminance
    const lum = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    // Contrast stretch
    const contrast = 1.6;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const adjusted = Math.min(255, Math.max(0, factor * (lum - 128) + 128));
    data[i] = adjusted;
    data[i + 1] = adjusted;
    data[i + 2] = adjusted;
  }
  ctx.putImageData(imgData, 0, 0);
  result = await detectQRCode(canvas);
  if (result) return result;

  // Pass 3: Inverted colors (for dark-mode QR codes on white background or vice-versa)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  ctx.putImageData(imgData, 0, 0);
  result = await detectQRCode(canvas);
  if (result) return result;

  throw new Error('No valid QR code could be detected in this image. Please ensure the QR code is clearly visible.');
}
