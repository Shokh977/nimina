'use client';

import { useEffect, useRef, useState } from 'react';

import { FORMATS } from '@/engine/constants';
import { render } from '@/engine/render';
import type { Project } from '@/engine/types';
import { loadImageFromUrl } from '@/lib/assetSrc';
import { createClient } from '@/lib/supabase/client';
import { getMusicLibraryUrl } from '@/lib/supabase/musicLibrary';
import { saveProjectData, saveProjectThumbnail } from '@/lib/supabase/projects';
import { getSignedAssetUrl, uploadThumbnail } from '@/lib/supabase/storage';
import { useEditorStore } from '@/store/editorStore';

const SAVE_DEBOUNCE_MS = 1500;
const THUMBNAIL_MIN_INTERVAL_MS = 60_000;
const THUMBNAIL_TARGET_PX = 320;

export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error';

/**
 * Loads `initialProject` (and its referenced images/music, via signed
 * Storage URLs) into the editor store on mount, then autosaves every
 * subsequent edit back to `projects.data` — debounced so rapid edits
 * collapse into one write, same spirit as the local undo-history debounce.
 * Also periodically regenerates and uploads a thumbnail.
 */
export function usePersistence(projectId: string, initialProject: Project): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('loading');
  const lastThumbnailAtRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    const supabase = createClient();

    async function maybeSaveThumbnail(project: Project) {
      const now = Date.now();
      if (now - lastThumbnailAtRef.current < THUMBNAIL_MIN_INTERVAL_MS) return;
      lastThumbnailAtRef.current = now;
      try {
        const fmt = FORMATS[project.format];
        const scale = THUMBNAIL_TARGET_PX / Math.max(fmt.w, fmt.h);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(fmt.w * scale);
        canvas.height = Math.round(fmt.h * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        render(ctx, project, useEditorStore.getState().assets.images, 0, scale);
        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        if (!blob) return;
        const path = await uploadThumbnail(supabase, projectId, blob);
        await saveProjectThumbnail(supabase, projectId, path);
      } catch (err) {
        // Thumbnail failures shouldn't surface as a save error — the
        // project data itself still saved fine.
        console.error('[persistence] thumbnail save failed:', err);
      }
    }

    function attachAutosave() {
      let prevProject = useEditorStore.getState().project;
      unsubscribe = useEditorStore.subscribe((state) => {
        if (state.project === prevProject) return;
        prevProject = state.project;
        setStatus('saving');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          void (async () => {
            try {
              await saveProjectData(supabase, projectId, state.project);
              await maybeSaveThumbnail(state.project);
              if (!cancelled) setStatus('saved');
            } catch (err) {
              console.error('[persistence] autosave failed:', err);
              if (!cancelled) setStatus('error');
            }
          })();
        }, SAVE_DEBOUNCE_MS);
      });
    }

    async function hydrate() {
      useEditorStore.getState().loadProject(initialProject, projectId);

      const imageIds = new Set<string>();
      initialProject.scenes.forEach((s) => {
        if (s.kind === 'image' && s.imgAssetId) imageIds.add(s.imgAssetId);
        if (s.kind === 'story') {
          s.screens.forEach((screen) => imageIds.add(screen.assetId));
          s.actions.forEach((a) => {
            if (a.type === 'launchApp' && a.iconAssetId) imageIds.add(a.iconAssetId);
            if (a.type === 'loading' && a.logoAssetId) imageIds.add(a.logoAssetId);
            if (a.type === 'notification' && a.iconAssetId) imageIds.add(a.iconAssetId);
          });
          s.sprites.forEach((sp) => {
            if (sp.source.kind === 'asset') imageIds.add(sp.source.assetId);
          });
        }
      });
      if (initialProject.iconAssetId) imageIds.add(initialProject.iconAssetId);

      await Promise.all(
        [...imageIds].map(async (assetId) => {
          try {
            const url = await getSignedAssetUrl(supabase, projectId, assetId);
            const img = await loadImageFromUrl(url);
            if (!cancelled) useEditorStore.getState().registerImage(assetId, img);
          } catch (err) {
            console.error('[persistence] failed to load image asset', assetId, err);
          }
        }),
      );

      if (initialProject.music) {
        const musicAssetId = initialProject.music.assetId;
        try {
          // Library tracks (see MotionPanel's onPickLibraryTrack) are
          // stored with a 'library:<path>' id and live in the public
          // music-library bucket; a user's own upload lives in the private
          // per-project assets bucket and needs a signed URL.
          const url = musicAssetId.startsWith('library:') ? getMusicLibraryUrl(supabase, musicAssetId.slice('library:'.length)) : await getSignedAssetUrl(supabase, projectId, musicAssetId);
          const res = await fetch(url);
          const arrayBuffer = await res.arrayBuffer();
          const audioCtx = new AudioContext();
          const buffer = await audioCtx.decodeAudioData(arrayBuffer);
          await audioCtx.close();
          if (!cancelled) {
            useEditorStore.setState((s) => ({ assets: { ...s.assets, audio: { ...s.assets.audio, [musicAssetId]: buffer } } }));
          }
        } catch (err) {
          console.error('[persistence] failed to load music asset', err);
        }
      }

      if (!cancelled) {
        setStatus('saved');
        attachAutosave();
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      unsubscribe?.();
    };
    // Only re-run if we're pointed at a different project — initialProject
    // is only meant to seed the very first hydration of this projectId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return status;
}
