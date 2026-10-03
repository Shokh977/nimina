/**
 * What may be uploaded, shared by the browser (early, friendly errors) and
 * /api/storage/upload (the actual enforcement — the size and type it
 * approves are baked into the signed upload URL).
 */

import type { Plan } from '@/lib/plan';

export interface StorageUsage {
  used: number;
  limit: number;
  plan: Plan;
}

export type UploadKind = 'image' | 'audio' | 'thumbnail' | 'template-preview' | 'music-library';

export const UPLOAD_RULES: Record<UploadKind, { maxBytes: number; types: string[]; label: string }> = {
  image: { maxBytes: 15 * 1024 * 1024, types: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], label: 'Images (PNG, JPEG, WebP or GIF) up to 15 MB' },
  audio: {
    maxBytes: 25 * 1024 * 1024,
    types: ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg', 'audio/webm', 'audio/flac'],
    label: 'Audio (MP3, M4A, AAC, WAV, OGG or FLAC) up to 25 MB',
  },
  thumbnail: { maxBytes: 1024 * 1024, types: ['image/jpeg'], label: 'Thumbnail' },
  'template-preview': { maxBytes: 100 * 1024 * 1024, types: ['video/mp4', 'video/webm'], label: 'Preview video up to 100 MB' },
  // Admin music library: always our transcoded 128 kbps MP3 (~1 MB/min) — 20 MB ≈ 20 minutes.
  'music-library': { maxBytes: 20 * 1024 * 1024, types: ['audio/mpeg'], label: 'MP3 up to 20 MB' },
};

/** Project/template ids and asset ids become path segments — keep them to a safe alphabet. */
export const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** null when acceptable, otherwise the reason. */
export function checkUpload(kind: UploadKind, contentType: string, size: number): string | null {
  const rule = UPLOAD_RULES[kind];
  if (!rule.types.includes(contentType)) return `That file type isn't supported. ${rule.label}.`;
  if (size <= 0) return 'That file is empty.';
  if (size > rule.maxBytes) return `That file is too large. ${rule.label}.`;
  return null;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(bytes % 1024 ** 3 === 0 ? 0 : 1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(bytes >= 100 * 1024 ** 2 || bytes % 1024 ** 2 === 0 ? 0 : 1)} MB`;
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}

/** What to tell someone who is out of space. */
export function quotaMessage(usage: StorageUsage): string {
  return `You've used ${formatBytes(usage.used)} of your ${formatBytes(usage.limit)} of storage. Delete a project you no longer need to free space${usage.plan === 'free' ? ', or upgrade to Pro for 5 GB' : ''}.`;
}
