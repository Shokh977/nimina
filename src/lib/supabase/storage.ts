import type { SupabaseClient } from '@supabase/supabase-js';

import { loadImageFromUrl } from '@/lib/assetSrc';
import { collectImageAssetIds } from '@/engine/project';
import type { AssetMap, Project } from '@/engine/types';

const BUCKET = 'assets';

/** Storage paths are {user_id}/{project_id}/{asset_id} — the JSON project
 * data only ever stores the short asset_id (see src/engine/types.ts), so
 * every read/write here reconstructs the full path from the caller's
 * current user + project. */
async function currentUserId(supabase: SupabaseClient): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  return user.id;
}

export async function uploadAsset(supabase: SupabaseClient, projectId: string, assetId: string, file: File | Blob): Promise<string> {
  const userId = await currentUserId(supabase);
  const path = `${userId}/${projectId}/${assetId}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return path;
}

export async function getSignedAssetUrl(supabase: SupabaseClient, projectId: string, assetId: string, expiresIn = 3600): Promise<string> {
  const userId = await currentUserId(supabase);
  const path = `${userId}/${projectId}/${assetId}`;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** Loads every real uploaded image a project's scenes reference (best
 * effort — an id with no real upload yet is simply left out of the
 * returned map, not an error). Shared by useTemplatePersistence.ts
 * (overriding placeholders once hydrated) and
 * TemplatePreviewRegenerator.tsx (rendering a preview from whatever the
 * admin has actually uploaded, not just a code-defined procedural sample). */
export async function loadProjectImageAssets(supabase: SupabaseClient, projectId: string, project: Project): Promise<AssetMap> {
  const assets: AssetMap = {};
  await Promise.all(
    [...collectImageAssetIds(project)].map(async (assetId) => {
      try {
        const url = await getSignedAssetUrl(supabase, projectId, assetId);
        assets[assetId] = await loadImageFromUrl(url);
      } catch {
        // no real upload for this asset id yet
      }
    }),
  );
  return assets;
}

export async function uploadThumbnail(supabase: SupabaseClient, projectId: string, blob: Blob): Promise<string> {
  const userId = await currentUserId(supabase);
  const path = `${userId}/${projectId}/thumbnail.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}

export async function getSignedThumbnailUrl(supabase: SupabaseClient, thumbnailPath: string | null, expiresIn = 3600): Promise<string | null> {
  if (!thumbnailPath) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(thumbnailPath, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

/** Copies every stored object under one project's folder to another's —
 * used by "Duplicate project" so the new project's (unchanged) asset ids
 * keep resolving correctly under its own path prefix. */
export async function duplicateProjectAssets(supabase: SupabaseClient, fromProjectId: string, toProjectId: string): Promise<void> {
  const userId = await currentUserId(supabase);
  const fromPrefix = `${userId}/${fromProjectId}`;
  const { data: files, error } = await supabase.storage.from(BUCKET).list(fromPrefix, { limit: 1000 });
  if (error || !files) return;
  await Promise.all(
    files.map((f) => supabase.storage.from(BUCKET).copy(`${fromPrefix}/${f.name}`, `${userId}/${toProjectId}/${f.name}`)),
  );
}

export async function deleteProjectAssets(supabase: SupabaseClient, projectId: string): Promise<void> {
  const userId = await currentUserId(supabase);
  const prefix = `${userId}/${projectId}`;
  const { data: files } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (!files || !files.length) return;
  await supabase.storage.from(BUCKET).remove(files.map((f) => `${prefix}/${f.name}`));
}
