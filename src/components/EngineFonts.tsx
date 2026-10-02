import '@/styles/engine-fonts.css';

/**
 * Self-hosted @font-face rules for the fonts the canvas engine references
 * by exact family name (src/engine/constants.ts FONTS), generated from the
 * pinned Fontsource packages by scripts/generate-font-css.mjs and served
 * from our own origin — nothing in the rendering path depends on an
 * external font host (a Google Fonts URL once 400'd and every font
 * silently fell back to system-ui). Render this on every route that draws
 * with the engine (editor, admin, template-preview rendering, dev pages);
 * declaring the faces costs only the CSS — a font file downloads once
 * something actually draws with it.
 */
export default function EngineFonts() {
  return null;
}
