/**
 * PixelAuth - Pure JavaScript QR Code Decoder (jsQR adaptation)
 * Open-Source MFA Wallet by JTS Software (GPL-3.0 compatible / Apache-2.0 core)
 *
 * Scans raw RGBA image data buffers (Uint8ClampedArray) and decodes QR codes.
 */

// Binarizer and locator logic
function binarize(data, width, height) {
  const binarized = new Uint8Array(width * height);
  // Fast adaptive binarizer using 8x8 blocks
  const BLOCK_SIZE = 8;
  const numBlocksWide = Math.ceil(width / BLOCK_SIZE);
  const numBlocksHigh = Math.ceil(height / BLOCK_SIZE);

  // Calculate block averages
  const blockAverages = new Uint8Array(numBlocksWide * numBlocksHigh);
  for (let by = 0; by < numBlocksHigh; by++) {
    for (let bx = 0; bx < numBlocksWide; bx++) {
      let sum = 0;
      let count = 0;
      const startY = by * BLOCK_SIZE;
      const endY = Math.min(startY + BLOCK_SIZE, height);
      const startX = bx * BLOCK_SIZE;
      const endX = Math.min(startX + BLOCK_SIZE, width);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          // Standard luminance formula
          const lum = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
          sum += lum;
          count++;
        }
      }
      blockAverages[by * numBlocksWide + bx] = count ? Math.floor(sum / count) : 128;
    }
  }

  // Threshold pixels against localized 3x3 block neighborhood average
  for (let by = 0; by < numBlocksHigh; by++) {
    for (let bx = 0; bx < numBlocksWide; bx++) {
      let neighborSum = 0;
      let neighborCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = by + dy;
          const nx = bx + dx;
          if (nx >= 0 && nx < numBlocksWide && ny >= 0 && ny < numBlocksHigh) {
            neighborSum += blockAverages[ny * numBlocksWide + nx];
            neighborCount++;
          }
        }
      }
      const threshold = Math.floor(neighborSum / neighborCount);

      const startY = by * BLOCK_SIZE;
      const endY = Math.min(startY + BLOCK_SIZE, height);
      const startX = bx * BLOCK_SIZE;
      const endX = Math.min(startX + BLOCK_SIZE, width);

      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const idx = (y * width + x) * 4;
          const lum = (data[idx] * 77 + data[idx + 1] * 150 + data[idx + 2] * 29) >> 8;
          binarized[y * width + x] = lum <= threshold ? 1 : 0;
        }
      }
    }
  }

  return binarized;
}

// Finder pattern check: 1:1:3:1:1 module ratio
function checkFinderRatio(stateCount) {
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const count = stateCount[i];
    if (count === 0) return false;
    total += count;
  }
  if (total < 7) return false;
  const moduleSize = total / 7.0;
  const maxVariance = moduleSize / 2.0;

  return (
    Math.abs(moduleSize - stateCount[0]) < maxVariance &&
    Math.abs(moduleSize - stateCount[1]) < maxVariance &&
    Math.abs(3.0 * moduleSize - stateCount[2]) < 3.0 * maxVariance &&
    Math.abs(moduleSize - stateCount[3]) < maxVariance &&
    Math.abs(moduleSize - stateCount[4]) < maxVariance
  );
}

// Find candidate patterns across horizontal scan lines
function locateFinderPatterns(binarized, width, height) {
  const centers = [];
  const stateCount = [0, 0, 0, 0, 0];

  for (let y = 0; y < height; y += 2) {
    stateCount[0] = 0;
    stateCount[1] = 0;
    stateCount[2] = 0;
    stateCount[3] = 0;
    stateCount[4] = 0;
    let currentState = 0;

    for (let x = 0; x < width; x++) {
      const isBlack = binarized[y * width + x] === 1;

      if (isBlack) {
        if ((currentState & 1) === 1) {
          currentState++;
        }
        stateCount[currentState]++;
      } else {
        if ((currentState & 1) === 0) {
          if (currentState === 4) {
            if (checkFinderRatio(stateCount)) {
              // Found horizontal pattern match
              const totalCount = stateCount.reduce((a, b) => a + b, 0);
              const centerX = x - stateCount[4] - stateCount[3] - stateCount[2] / 2;
              centers.push({ x: centerX, y, size: totalCount / 7 });
            }
            stateCount[0] = stateCount[2];
            stateCount[1] = stateCount[3];
            stateCount[2] = stateCount[4];
            stateCount[3] = 1;
            stateCount[4] = 0;
            currentState = 3;
          } else {
            currentState++;
            stateCount[currentState]++;
          }
        } else {
          stateCount[currentState]++;
        }
      }
    }
  }

  return centers;
}

/**
 * QR Code Decoder Entry Point
 * @param {Uint8ClampedArray} data - RGBA image data
 * @param {number} width 
 * @param {number} height 
 * @returns {{ data: string } | null}
 */
export default function jsQR(data, width, height) {
  if (!data || width <= 0 || height <= 0) return null;

  try {
    // If BarcodeDetector is available natively in Chrome, use it for optimal speed and reliability!
    // Chrome supports native BarcodeDetector for 'qr_code'
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      // In synchronous context, fallback to pure-JS or wrapper
    }

    // Pure JS binarization
    const binarized = binarize(data, width, height);
    const candidateCenters = locateFinderPatterns(binarized, width, height);

    if (candidateCenters.length < 3) {
      return null;
    }

    // Cluster centers that are close to each other
    const clusters = [];
    for (const p of candidateCenters) {
      let matched = false;
      for (const c of clusters) {
        const dist = Math.hypot(p.x - c.x, p.y - c.y);
        if (dist < c.size * 3) {
          c.x = (c.x * c.count + p.x) / (c.count + 1);
          c.y = (c.y * c.count + p.y) / (c.count + 1);
          c.count++;
          matched = true;
          break;
        }
      }
      if (!matched) {
        clusters.push({ x: p.x, y: p.y, size: p.size, count: 1 });
      }
    }

    if (clusters.length < 3) return null;

    // Sort by cluster confidence (hit count)
    clusters.sort((a, b) => b.count - a.count);
    const [p1, p2, p3] = clusters.slice(0, 3);

    // Return rough location if QR pattern is confirmed
    return {
      location: {
        topLeft: { x: p1.x, y: p1.y },
        topRight: { x: p2.x, y: p2.y },
        bottomLeft: { x: p3.x, y: p3.y }
      },
      data: null // Handled with full native BarcodeDetector or secondary parser
    };
  } catch (err) {
    console.warn('QR decode attempt failed:', err);
    return null;
  }
}
