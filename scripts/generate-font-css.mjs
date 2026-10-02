#!/usr/bin/env node
/**
 * Generates the self-hosted @font-face CSS the canvas engine uses, from the
 * pinned Fontsource packages in package.json — no external font requests
 * anywhere in the rendering path (an external Google Fonts link once 400'd
 * and every export silently fell back to system-ui).
 *
 * Fontsource names its variable families "<Name> Variable"; the engine
 * references fonts by their real names (src/engine/constants.ts FONTS,
 * src/engine/scriptFonts.ts), so this rewrites each family name and points
 * url() at the package's files (Next bundles and serves them from our own
 * origin with hashed, immutable URLs). unicode-range slicing is kept as-is,
 * so a browser only downloads the slices whose characters a render uses.
 *
 * Outputs (committed; re-run after bumping a @fontsource* package):
 *   src/styles/engine-fonts.css          — the 6 Latin engine fonts, loaded on every engine route
 *   src/styles/script-fonts/<key>.css    — one per non-Latin script, loaded on demand
 *                                          (src/components/scriptFontLoader.ts)
 *
 * Usage: node scripts/generate-font-css.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * pkg, css file inside it, the family name the engine uses, and optionally
 * which subsets to keep.
 *
 * `instances`: the weights the engine was designed against — what the
 * original Google Fonts request asked for (Bricolage/Syne `400;800`, Space
 * Grotesk/Fraunces `400;700`). Each becomes its own @font-face with a
 * single font-weight, so the browser's weight matching behaves exactly as
 * it did with those static instances: a 700 request (callouts, badges, the
 * CTA button) resolves to the 800 face and draws at 800 — a full-range
 * variable face would draw a true, visibly lighter 700 instead.
 */
const ENGINE = [
  // opsz variants carry the optical-size axis Google served (opsz,wght) — Bricolage and Fraunces pick their glyph design from it.
  { pkg: '@fontsource-variable/bricolage-grotesque', css: 'opsz.css', family: 'Bricolage Grotesque', instances: [400, 800] },
  { pkg: '@fontsource-variable/syne', css: 'wght.css', family: 'Syne', instances: [400, 800] },
  { pkg: '@fontsource-variable/space-grotesk', css: 'wght.css', family: 'Space Grotesk', instances: [400, 700] },
  { pkg: '@fontsource-variable/fraunces', css: 'opsz.css', family: 'Fraunces', instances: [400, 700] },
  { pkg: '@fontsource/dm-serif-display', css: '400.css', family: 'DM Serif Display' },
  { pkg: '@fontsource-variable/figtree', css: 'wght.css', family: 'Figtree' },
];

const SCRIPTS = [
  // Cyrillic/Greek only — Latin glyphs always come from the engine font ahead of it in the stack.
  { key: 'cyrillic', pkg: '@fontsource-variable/noto-sans', css: 'wght.css', family: 'Noto Sans', subsets: ['cyrillic', 'cyrillic-ext', 'greek', 'greek-ext'] },
  { key: 'jp', pkg: '@fontsource-variable/noto-sans-jp', css: 'wght.css', family: 'Noto Sans JP' },
  { key: 'kr', pkg: '@fontsource-variable/noto-sans-kr', css: 'wght.css', family: 'Noto Sans KR' },
  { key: 'sc', pkg: '@fontsource-variable/noto-sans-sc', css: 'wght.css', family: 'Noto Sans SC' },
  { key: 'tc', pkg: '@fontsource-variable/noto-sans-tc', css: 'wght.css', family: 'Noto Sans TC' },
  { key: 'arabic', pkg: '@fontsource-variable/noto-sans-arabic', css: 'wght.css', family: 'Noto Sans Arabic', subsets: ['arabic'] },
  { key: 'hebrew', pkg: '@fontsource-variable/noto-sans-hebrew', css: 'wght.css', family: 'Noto Sans Hebrew', subsets: ['hebrew'] },
  { key: 'devanagari', pkg: '@fontsource-variable/noto-sans-devanagari', css: 'wght.css', family: 'Noto Sans Devanagari', subsets: ['devanagari'] },
];

function rewrite({ pkg, css, family, subsets, instances }, outFile) {
  const pkgDir = path.join(ROOT, 'node_modules', pkg);
  const src = fs.readFileSync(path.join(pkgDir, css), 'utf8');
  const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;
  const rel = path.relative(path.dirname(outFile), path.join(pkgDir, 'files')).split(path.sep).join('/');
  const blocks = [...src.matchAll(/\/\* ([^*]+) \*\/\s*@font-face \{([^}]*)\}/g)]
    .filter(([, name, body]) => /font-style: normal/.test(body) && (!subsets || subsets.some((s) => new RegExp(`-${s}-[a-z]+-normal$`).test(name.trim()))))
    .flatMap(([, name, body]) => {
      const face = body.replace(/font-family: '[^']+'/, `font-family: '${family}'`).replace(/url\(\.\/files\//g, `url(${rel}/`);
      if (!instances) return [`/* ${name.trim()} */\n@font-face {${face}}`];
      return instances.map((w) => `/* ${name.trim()} @ ${w} */\n@font-face {${face.replace(/font-weight: [^;]+;/, `font-weight: ${w};`)}}`);
    });
  if (!blocks.length) throw new Error(`no @font-face blocks kept for ${pkg}/${css}`);
  return `/* ${family} — ${pkg}@${version} (${css}) */\n${blocks.join('\n\n')}\n`;
}

const HEADER = '/* Generated by scripts/generate-font-css.mjs — do not edit by hand. */\n\n';

const engineOut = path.join(ROOT, 'src/styles/engine-fonts.css');
fs.mkdirSync(path.dirname(engineOut), { recursive: true });
fs.writeFileSync(engineOut, HEADER + ENGINE.map((e) => rewrite(e, engineOut)).join('\n'));
console.log('wrote', path.relative(ROOT, engineOut));

const scriptDir = path.join(ROOT, 'src/styles/script-fonts');
fs.mkdirSync(scriptDir, { recursive: true });
for (const s of SCRIPTS) {
  const out = path.join(scriptDir, `${s.key}.css`);
  fs.writeFileSync(out, HEADER + rewrite(s, out));
  console.log('wrote', path.relative(ROOT, out));
}
