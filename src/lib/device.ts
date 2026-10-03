import type { ExportResolution } from '@/engine/export';

/**
 * Phone detection for the two places the editor treats phones differently:
 * the mobile layout (src/components/editor/mobile/) and the export cap below.
 * A phone = a touch-first device whose screen is narrow (portrait) or short
 * (landscape). Tablets and touch laptops get the desktop editor.
 */
export const PHONE_QUERY = '(max-width: 767px), (pointer: coarse) and (max-height: 500px)';

export function isPhone(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(PHONE_QUERY).matches;
}

/**
 * Phones export at most 720p. Rendering and encoding run in the browser,
 * and mobile browsers give a page far less memory than desktop ones (and
 * kill it, rather than slowing down, when it asks for more) — 1080p and 4K
 * frames plus the encoder's buffers are where that starts failing. The UI
 * says so up front instead of letting a long render die near the end.
 */
export const PHONE_MAX_EXPORT: ExportResolution = '720p';
export const PHONE_EXPORT_NOTE = 'Phones export up to 720p — larger videos need more memory than mobile browsers reliably give a web page. For 1080p or 4K, open this project on a computer.';

const RANK: Record<ExportResolution, number> = { '720p': 0, '1080p': 1, '4k': 2 };

/** The plan's export ceiling, lowered to PHONE_MAX_EXPORT on a phone. */
export function deviceExportCap(planMax: ExportResolution): ExportResolution {
  return isPhone() && RANK[planMax] > RANK[PHONE_MAX_EXPORT] ? PHONE_MAX_EXPORT : planMax;
}
