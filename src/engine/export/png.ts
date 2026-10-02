/**
 * Minimal truecolor (RGB, 8-bit, no alpha) PNG encoder for store
 * screenshots. canvas.toBlob('image/png') always writes RGBA, and App
 * Store Connect rejects screenshots with an alpha channel ("images can't
 * include alpha channels or transparencies"); Google Play likewise asks
 * for 24-bit PNG with no alpha — see storePresets.ts for both sources.
 * Rendered stills are fully opaque (drawBg fills every pixel), so the
 * alpha channel is dropped, not composited.
 */
import { zlibSync } from 'fflate';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array, crc = 0xffffffff): number {
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return crc;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, (crc32(out.subarray(4, 8 + data.length)) ^ 0xffffffff) >>> 0);
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Filters each scanline with whichever of the five PNG filters gives the
 * smallest sum of absolute (signed) residuals — libpng's standard
 * heuristic, worth ~2x smaller files on gradients vs. no filtering. */
function filterScanlines(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const stride = width * 3;
  const out = new Uint8Array(height * (stride + 1));
  let prev = new Uint8Array(stride);
  let cur = new Uint8Array(stride);
  const cand = [new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride), new Uint8Array(stride)];
  for (let y = 0; y < height; y++) {
    for (let x = 0, i = y * width * 4, j = 0; x < width; x++, i += 4, j += 3) {
      cur[j] = rgba[i];
      cur[j + 1] = rgba[i + 1];
      cur[j + 2] = rgba[i + 2];
    }
    let best = 0,
      bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const c = cand[f];
      let sum = 0;
      for (let j = 0; j < stride; j++) {
        const a = j >= 3 ? cur[j - 3] : 0,
          b = prev[j],
          d = j >= 3 ? prev[j - 3] : 0;
        const v = f === 0 ? cur[j] : f === 1 ? cur[j] - a : f === 2 ? cur[j] - b : f === 3 ? cur[j] - ((a + b) >> 1) : cur[j] - paeth(a, b, d);
        const byte = v & 0xff;
        c[j] = byte;
        sum += byte < 128 ? byte : 256 - byte;
        if (sum >= bestSum) break;
      }
      if (sum < bestSum) {
        bestSum = sum;
        best = f;
      }
    }
    const row = y * (stride + 1);
    out[row] = best;
    out.set(cand[best], row + 1);
    [prev, cur] = [cur, prev];
  }
  return out;
}

/** Encodes `image` (from getImageData) as an RGB PNG with an sRGB chunk
 * (canvas pixels are sRGB). */
export function encodeRgbPng(image: ImageData): Blob {
  const { width, height, data } = image;
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type 2 = truecolor RGB, no alpha
  // compression 0, filter 0, interlace 0
  const idat = zlibSync(filterScanlines(data, width, height), { level: 6 });
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const parts = [signature, chunk('IHDR', ihdr), chunk('sRGB', new Uint8Array([0])), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  return new Blob(parts as BlobPart[], { type: 'image/png' });
}
