import type { ImageAsset } from '@/engine/types';

/** A browser-displayable URL for an engine ImageAsset (used in <img> tags for thumbnails). */
export function assetSrc(asset: ImageAsset): string {
  return asset instanceof HTMLImageElement ? asset.src : asset.toDataURL('image/jpeg', 0.85);
}

export function loadImageFile(file: File): Promise<{ image: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve({ image: img });
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Loads an image from a (typically cross-origin, e.g. a Supabase Storage
 * signed URL) URL for canvas use. `crossOrigin` must be set before `src` —
 * otherwise the canvas gets tainted and export/thumbnail generation
 * (`toBlob`/`toDataURL`/`captureStream`) throws a SecurityError. */
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

let idCounter = 1;
export function newAssetId(prefix: string): string {
  return `${prefix}-${Date.now()}-${idCounter++}`;
}
