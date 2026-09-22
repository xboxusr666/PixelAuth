/**
 * PixelAuth - Pure JavaScript QR Code Generator
 * Open-Source MFA Wallet by JTS Software (GPL-3.0)
 *
 * Generates standard QR Code (Model 2) bit matrices and renders
 * crisp pixel-art QR codes to HTML5 Canvas elements.
 */

// QR Code Error Correction Levels: L (7%), M (15%), Q (25%), H (30%)
const EC_LEVEL = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2
};

// Galois Field (GF(256)) lookup tables
const GF256_EXP = new Uint8Array(512);
const GF256_LOG = new Uint8Array(256);
(function initGF() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    GF256_EXP[i] = val;
    GF256_EXP[i + 255] = val;
    GF256_LOG[val] = i;
    val <<= 1;
    if (val & 0x100) {
      val ^= 0x11d; // GF(256) primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
    }
  }
})();

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return GF256_EXP[GF256_LOG[x] + GF256_LOG[y]];
}

// Generate Reed-Solomon error correction generator polynomial
function getRSGeneratorPoly(numECBytes) {
  let poly = [1];
  for (let i = 0; i < numECBytes; i++) {
    const factor = [1, GF256_EXP[i]];
    const newPoly = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= gfMul(poly[j], factor[0]);
      newPoly[j + 1] ^= gfMul(poly[j], factor[1]);
    }
    poly = newPoly;
  }
  return poly;
}

// Compute Reed-Solomon error correction bytes
function calculateErrorCorrection(dataBytes, numECBytes) {
  const genPoly = getRSGeneratorPoly(numECBytes);
  const remainder = new Array(numECBytes).fill(0);

  for (let i = 0; i < dataBytes.length; i++) {
    const factor = dataBytes[i] ^ remainder[0];
    remainder.shift();
    remainder.push(0);

    for (let j = 0; j < numECBytes; j++) {
      remainder[j] ^= gfMul(genPoly[j + 1], factor);
    }
  }

  return remainder;
}

// Determine best QR Code version (Version 1-10) for text length
const VERSION_CAPACITIES_BYTE_M = [
  0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 251, 287, 331, 362, 412
];

function selectVersion(byteLength) {
  for (let v = 1; v < VERSION_CAPACITIES_BYTE_M.length; v++) {
    if (byteLength <= VERSION_CAPACITIES_BYTE_M[v]) {
      return v;
    }
  }
  return 10; // Default cap for authenticator URIs
}

// EC bytes and block table for Level M
const EC_SPECS_M = {
  1: { ecBytesPerBlock: 10, blocks: 1 },
  2: { ecBytesPerBlock: 16, blocks: 1 },
  3: { ecBytesPerBlock: 26, blocks: 1 },
  4: { ecBytesPerBlock: 18, blocks: 2 },
  5: { ecBytesPerBlock: 24, blocks: 2 },
  6: { ecBytesPerBlock: 16, blocks: 4 },
  7: { ecBytesPerBlock: 18, blocks: 4 },
  8: { ecBytesPerBlock: 22, blocks: 4 },
  9: { ecBytesPerBlock: 22, blocks: 5 },
  10: { ecBytesPerBlock: 26, blocks: 5 }
};

// Alignment pattern centers for Versions 1-10
const ALIGNMENT_PATTERN_POS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50]
];

export class QRCodeGenerator {
  /**
   * Generates a 2D boolean matrix representing the QR Code.
   * @param {string} text 
   * @returns {{ size: number, matrix: boolean[][] }}
   */
  static generateMatrix(text) {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(text);
    const version = selectVersion(dataBytes.length);
    const size = version * 4 + 17;

    // Create 2D matrix (true = black, false = white, null = empty)
    const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
    const isReserved = Array.from({ length: size }, () => new Array(size).fill(false));

    function setModule(r, c, val, reserve = true) {
      matrix[r][c] = val;
      if (reserve) isReserved[r][c] = true;
    }

    // 1. Draw 3 Finder Patterns (7x7) + separators
    function drawFinder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const nr = row + r;
          const nc = col + c;
          if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
            const isBorder = (r === -1 || r === 7 || c === -1 || c === 7);
            if (isBorder) {
              setModule(nr, nc, false);
            } else if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
              setModule(nr, nc, true);
            } else {
              setModule(nr, nc, false);
            }
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // 2. Timing patterns (Row 6 and Column 6)
    for (let i = 8; i < size - 8; i++) {
      const val = i % 2 === 0;
      if (matrix[6][i] === null) setModule(6, i, val);
      if (matrix[i][6] === null) setModule(i, 6, val);
    }

    // 3. Dark module at (size - 8, 8)
    setModule(size - 8, 8, true);

    // 4. Alignment patterns for Version >= 2
    const alignCoords = ALIGNMENT_PATTERN_POS[version];
    for (let i = 0; i < alignCoords.length; i++) {
      for (let j = 0; j < alignCoords.length; j++) {
        const ar = alignCoords[i];
        const ac = alignCoords[j];
        if (matrix[ar][ac] !== null) continue; // Skip finder areas

        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const isOuter = Math.abs(r) === 2 || Math.abs(c) === 2;
            const isCenter = r === 0 && c === 0;
            setModule(ar + r, ac + c, isOuter || isCenter);
          }
        }
      }
    }

    // 5. Reserve format info areas around finders
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        if (matrix[8][i] === null) setModule(8, i, false);
        if (matrix[i][8] === null) setModule(i, 8, false);
      }
    }
    for (let i = size - 8; i < size; i++) {
      if (matrix[8][i] === null) setModule(8, i, false);
      if (matrix[i][8] === null) setModule(i, 8, false);
    }

    // 6. Encode Data with 8-bit byte mode
    const totalDataCapacity = VERSION_CAPACITIES_BYTE_M[version];
    const bitStream = [];

    function pushBits(val, length) {
      for (let i = length - 1; i >= 0; i--) {
        bitStream.push((val >> i) & 1);
      }
    }

    // Mode indicator: 0100 for Byte Mode
    pushBits(0b0100, 4);
    // Character count indicator: 8 bits for Byte mode in v1-v9, 16 in v10+
    pushBits(dataBytes.length, version < 10 ? 8 : 16);
    // Data bytes
    for (const b of dataBytes) {
      pushBits(b, 8);
    }
    // Terminator
    const padNeeded = totalDataCapacity * 8 - bitStream.length;
    const termLength = Math.min(4, Math.max(0, padNeeded));
    pushBits(0, termLength);

    // Byte align
    while (bitStream.length % 8 !== 0) {
      bitStream.push(0);
    }

    // Pad bytes alternating 0xEC (11101100) and 0x11 (00010001)
    const padBytes = [0xec, 0x11];
    let padIdx = 0;
    while (bitStream.length < totalDataCapacity * 8) {
      pushBits(padBytes[padIdx % 2], 8);
      padIdx++;
    }

    // Convert bitStream to byte array
    const rawDataBytes = [];
    for (let i = 0; i < bitStream.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | bitStream[i + j];
      }
      rawDataBytes.push(b);
    }

    // Calculate Reed Solomon Error Correction
    const spec = EC_SPECS_M[version];
    const ecBytes = calculateErrorCorrection(rawDataBytes, spec.ecBytesPerBlock);
    const finalCodewords = [...rawDataBytes, ...ecBytes];

    // 7. Place Codewords into matrix (right to left in pairs, zigzag)
    let bitIdx = 0;
    const allBits = [];
    for (const byte of finalCodewords) {
      for (let i = 7; i >= 0; i--) {
        allBits.push((byte >> i) & 1);
      }
    }

    let upwards = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right--; // Skip vertical timing pattern column

      const rows = upwards
        ? Array.from({ length: size }, (_, k) => size - 1 - k)
        : Array.from({ length: size }, (_, k) => k);

      for (const r of rows) {
        for (const col of [right, right - 1]) {
          if (!isReserved[r][col]) {
            const bit = bitIdx < allBits.length ? allBits[bitIdx++] : 0;
            // Apply Mask 0: (row + column) % 2 === 0
            const mask = (r + col) % 2 === 0;
            matrix[r][col] = (bit === 1) ^ mask;
          }
        }
      }
      upwards = !upwards;
    }

    // 8. Format Information for EC Level M (00) and Mask 0 (000) = 00000 -> 0x5412 XOR
    // Format pattern for Level M + Mask 0 with BCH error code: 0x5412
    const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
    // Top-left
    for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
    matrix[8][7] = formatBits[6] === 1;
    matrix[8][8] = formatBits[7] === 1;
    matrix[7][8] = formatBits[8] === 1;
    for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

    // Bottom-left / Top-right
    for (let i = 0; i < 8; i++) matrix[size - 1 - i][8] = formatBits[i] === 1;
    for (let i = 8; i < 15; i++) matrix[8][size - 15 + i] = formatBits[i] === 1;

    return { size, matrix };
  }

  /**
   * Renders a QR code onto an HTML5 Canvas element with pixel-art styling.
   * @param {HTMLCanvasElement} canvas 
   * @param {string} text 
   * @param {object} [options]
   */
  static renderToCanvas(canvas, text, options = {}) {
    const { size, matrix } = this.generateMatrix(text);
    const pixelScale = options.scale || 6;
    const margin = options.margin || 4;
    const darkColor = options.darkColor || '#0f172a';
    const lightColor = options.lightColor || '#ffffff';

    const canvasSize = (size + margin * 2) * pixelScale;
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Draw background
    ctx.fillStyle = lightColor;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw QR pixels
    ctx.fillStyle = darkColor;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            (c + margin) * pixelScale,
            (r + margin) * pixelScale,
            pixelScale,
            pixelScale
          );
        }
      }
    }
  }
}
