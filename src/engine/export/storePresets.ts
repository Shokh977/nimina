/**
 * App Store / Google Play screenshot sizes for the image (still) export.
 *
 * These change with new devices — re-check both sources before editing,
 * and keep every value in this one file:
 *
 *   Apple:  https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/
 *           (checked 2026-10-02) — iPhone 6.9" accepts 1320x2868, 1290x2796
 *           or 1260x2736; iPhone 6.5" accepts 1242x2688 or 1284x2778; iPad
 *           13" accepts 2064x2752 or 2048x2732. JPEG/PNG only, and "images
 *           can't include alpha channels or transparencies" — which is why
 *           PNGs are written by ./png.ts (RGB, no alpha) rather than
 *           canvas.toBlob, which always emits RGBA.
 *   Google: https://support.google.com/googleplay/android-developer/answer/9866151
 *           (checked 2026-10-02) — JPEG or 24-bit PNG (no alpha), each side
 *           320-3840px, long side at most 2x the short side; promotion
 *           eligibility wants >= 1080px, 9:16 portrait (min 1080x1920).
 *           Google publishes no single required tablet size — 1600x2560
 *           (10:16) is a common 10" tablet resolution inside those limits.
 */

export type StorePresetId = 'iphone-6-9' | 'iphone-6-5' | 'ipad-13' | 'android-phone' | 'android-tablet';

export interface StorePreset {
  id: StorePresetId;
  label: string;
  store: 'App Store' | 'Google Play';
  width: number;
  height: number;
}

export const STORE_PRESETS: StorePreset[] = [
  { id: 'iphone-6-9', label: 'iPhone 6.9"', store: 'App Store', width: 1320, height: 2868 },
  { id: 'iphone-6-5', label: 'iPhone 6.5"', store: 'App Store', width: 1242, height: 2688 },
  { id: 'ipad-13', label: 'iPad 13"', store: 'App Store', width: 2064, height: 2752 },
  { id: 'android-phone', label: 'Android phone', store: 'Google Play', width: 1080, height: 1920 },
  { id: 'android-tablet', label: 'Android tablet', store: 'Google Play', width: 1600, height: 2560 },
];

/** Google Play's hard limits, also used to bound the Custom size inputs. */
export const CUSTOM_SIZE_MIN = 320;
export const CUSTOM_SIZE_MAX = 3840;
