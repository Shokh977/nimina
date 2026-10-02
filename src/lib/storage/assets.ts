import { loadImageFromUrl } from '@/lib/assetSrc';
import { collectImageAssetIds } from '@/engine/project';
import type { AssetMap, Project } from '@/engine/types';
import { checkUpload, type UploadKind } from './rules';

/**
 * Browser side of file storage (Cloudflare R2). The browser never holds
 * storage credentials: every upload is approved by /api/storage/upload
 * (plan/file checks, key under the user's own folder), which hands back a
 * short-lived signed URL the file is PUT to directly; reads go through
 * signed URLs from /api/storage/urls. Project data only stores the short
 * asset id — the full key is {user_id}/{project_id}/{asset_id}, built on
 * the server from the signed-in user.
 */

export const UPLOAD_ERROR_EVENT = 'nimina:upload-error';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

async function signedUpload(kind: UploadKind, projectId: string, assetId: string | undefined, file: Blob): Promise<{ path?: string; publicUrl?: string }> {
  const contentType = file.type;
  const problem = checkUpload(kind, contentType, file.size);
  if (problem) throw new Error(problem);
  const signed = await postJson<{ url: string; headers: Record<string, string>; path?: string; publicUrl?: string }>('/api/storage/upload', { kind, projectId, assetId, contentType, size: file.size });
  const res = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: file });
  if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
  return { path: signed.path, publicUrl: signed.publicUrl };
}

/** Uploads a screenshot/icon (or a music file) for a project. Failures are
 * also announced to the editor (SaveStatusBadge) so they aren't silent. */
export async function uploadAsset(projectId: string, assetId: string, file: File | Blob, kind: 'image' | 'audio' = file.type.startsWith('audio/') ? 'audio' : 'image'): Promise<void> {
  try {
    await signedUpload(kind, projectId, assetId, file);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(UPLOAD_ERROR_EVENT, { detail: message }));
    throw err;
  }
}

export async function uploadThumbnail(projectId: string, blob: Blob): Promise<string> {
  const { path } = await signedUpload('thumbnail', projectId, undefined, blob);
  return path!;
}

/** Admin only: a template's preview video, to the public bucket. Returns its public URL. */
export async function uploadTemplatePreview(templateId: string, tag: '9x16' | '16x9', blob: Blob): Promise<string> {
  const ext = blob.type === 'video/webm' ? 'webm' : 'mp4';
  const { publicUrl } = await signedUpload('template-preview', templateId, `preview-${tag}.${ext}`, blob);
  return publicUrl!;
}

export async function getSignedAssetUrls(projectId: string, assetIds: string[]): Promise<Record<string, string>> {
  if (!assetIds.length) return {};
  const { urls } = await postJson<{ urls: Record<string, string> }>('/api/storage/urls', { projectId, assetIds });
  return urls;
}

export async function getSignedAssetUrl(projectId: string, assetId: string): Promise<string> {
  return (await getSignedAssetUrls(projectId, [assetId]))[assetId];
}

/** Loads every real uploaded image a project's scenes reference (best
 * effort — an id with no upload yet is simply left out of the map). Shared
 * by useTemplatePersistence.ts and TemplatePreviewRegenerator.tsx. */
export async function loadProjectImageAssets(projectId: string, project: Project): Promise<AssetMap> {
  const assets: AssetMap = {};
  const ids = [...collectImageAssetIds(project)];
  let urls: Record<string, string> = {};
  try {
    urls = await getSignedAssetUrls(projectId, ids);
  } catch {
    return assets;
  }
  await Promise.all(
    ids.map(async (assetId) => {
      try {
        if (urls[assetId]) assets[assetId] = await loadImageFromUrl(urls[assetId]);
      } catch {
        // no real upload for this asset id yet
      }
    }),
  );
  return assets;
}

/** Copies every file in one project folder to another — "Duplicate
 * project" keeps the (unchanged) asset ids resolving under the new id. */
export async function duplicateProjectAssets(fromProjectId: string, toProjectId: string): Promise<void> {
  await postJson('/api/storage/project', { action: 'duplicate', from: fromProjectId, to: toProjectId });
}

export async function deleteProjectAssets(projectId: string): Promise<void> {
  await postJson('/api/storage/project', { action: 'delete', projectId });
}

/** Public URL of a file in the public bucket (music library, template previews). */
export function publicFileUrl(key: string): string {
  const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? '').replace(/\/+$/, '');
  return `${base}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
