// Rasterizes the committed brand SVGs (public/brand/*.svg) into the PNG/ICO
// files the web platform needs (favicons, apple-touch-icon, manifest icons)
// plus a static Open Graph image. Re-run with `npm run generate:brand-assets`
// whenever the source SVGs in public/brand/ change — nothing here runs at
// app build/runtime, these are committed static files.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const brand = resolve(root, 'public/brand');
const pub = resolve(root, 'public');

const faviconSvg = readFileSync(resolve(brand, 'favicon.svg'));
// At 16/32px the standard favicon's ~3px gap between the N-shape and the
// triangle anti-aliases into a single blob. favicon-small.svg is the same
// mark with the triangle shifted right (wider gap) — used only for the ICO
// and favicon-32.png; favicon-180/icon-192/icon-512 are large enough that
// the real mark stays legible.
const faviconSmallSvg = readFileSync(resolve(brand, 'favicon-small.svg'));
const logoFullLight = readFileSync(resolve(brand, 'logo-full-light.svg'));

async function pngFromSvg(svgBuffer, size) {
  return sharp(svgBuffer, { density: 384 }).resize(size, size).png().toBuffer();
}

// Minimal ICO writer: PNG-format icon entries (supported since Windows
// Vista, and by every modern browser) — no need for a BMP encoder or a
// third-party packer just to concatenate a couple of PNGs with a header.
async function buildIcoFile(sizes) {
  const pngs = await Promise.all(sizes.map((s) => pngFromSvg(faviconSmallSvg, s)));
  const count = pngs.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = 6 + 16 * count;
  const dirEntries = [];
  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    const png = pngs[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256px)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8); // data size
    entry.writeUInt32LE(offset, 12); // data offset
    dirEntries.push(entry);
    offset += png.length;
  }
  return Buffer.concat([header, ...dirEntries, ...pngs]);
}

async function main() {
  console.log('Generating favicon-32.png, favicon-180.png, icon-192.png, icon-512.png...');
  await Promise.all([
    pngFromSvg(faviconSmallSvg, 32).then((b) => writeFileSync(resolve(pub, 'favicon-32.png'), b)),
    pngFromSvg(faviconSvg, 180).then((b) => writeFileSync(resolve(pub, 'favicon-180.png'), b)),
    pngFromSvg(faviconSvg, 192).then((b) => writeFileSync(resolve(pub, 'icon-192.png'), b)),
    pngFromSvg(faviconSvg, 512).then((b) => writeFileSync(resolve(pub, 'icon-512.png'), b)),
  ]);

  console.log('Generating favicon.ico (16 + 32px)...');
  const ico = await buildIcoFile([16, 32]);
  writeFileSync(resolve(root, 'src/app/favicon.ico'), ico);

  console.log('Generating og-image.png (1200x630)...');
  const markSize = 220;
  const markPng = await sharp(logoFullLight, { density: 384 })
    .resize({ height: markSize })
    .png()
    .toBuffer();
  const markMeta = await sharp(markPng).metadata();
  const markW = markMeta.width ?? markSize;
  const markX = Math.round((1200 - markW) / 2);
  const markY = 220;

  const ogSvg = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <rect width="1200" height="630" fill="#121317"/>
      <text x="600" y="460" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#9aa1af">App promos that move</text>
    </svg>
  `);
  const ogBase = await sharp(ogSvg).png().toBuffer();
  const ogImage = await sharp(ogBase)
    .composite([{ input: markPng, left: markX, top: markY }])
    .png()
    .toBuffer();
  writeFileSync(resolve(brand, 'og-image.png'), ogImage);

  console.log('Done.');
}

main();
