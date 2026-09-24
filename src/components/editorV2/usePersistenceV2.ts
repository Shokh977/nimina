'use client';

import { useEffect, useRef, useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { saveProjectV2Data, saveProjectV2Thumbnail } from '@/lib/supabase/projectsV2';
import { getSignedAssetUrl, uploadThumbnail } from '@/lib/supabase/storage';
import { useEditorV2Store } from '@/store/editorV2Store';
import type { SceneProjectV2 } from '@/engine2/types';

const SAVE_DEBOUNCE_MS = 1500;
const THUMBNAIL_MIN_INTERVAL_MS = 60_000;

export type SaveStatus = 'loading' | 'saving' | 'saved' | 'error';

/**
 * Infrastructure merge: Engine v2's equivalent of the classic editor's
 * usePersistence.ts — real Supabase persistence (src/lib/supabase/
 * projectsV2.ts) replacing the old localStorage-only engine2Projects.ts.
 * Same shape: hydrate `initialProject` + its referenced assets (real
 * screenshots/stickers, video, music) on mount, then debounced autosave on
 * every subsequent committed edit.
 *
 * Asset resolution differs slightly from classic's because v2's content
 * references aren't uniform: screenshot/sticker images are found by
 * walking `layers` for `slotId`/`imageSlotId` (mirrors classic's
 * `imgAssetId` walk); video is found via `VideoProps.assetId` (added
 * specifically for this — a video layer's `src` is a live, resolved URL
 * that's never authoritative once `assetId` exists, since signed URLs
 * expire and would go stale between sessions); music is a single
 * `musicAssetId` on the project (decoupled from the runtime AudioBuffer,
 * which can't be JSON-serialized — see types.ts's doc comment on it).
 */
export function usePersistenceV2(projectId: string, initialProject: SceneProjectV2): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('loading');
  const lastThumbnailAtRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    const supabase = createClient();

    async function maybeSaveThumbnail() {
      const now = Date.now();
      if (now - lastThumbnailAtRef.current < THUMBNAIL_MIN_INTERVAL_MS) return;
      lastThumbnailAtRef.current = now;
      try {
        // Reuses whatever the live preview canvas is currently showing —
        // simpler than classic's approach (a dedicated offscreen render at
        // thumbnail size), since Stage2's canvas already exists and is
        // already at a small preview resolution. A real per-frame render
        // pass (matching classic's exact framing) is a reasonable future
        // improvement, not attempted here.
        const canvas = document.querySelector('canvas');
        if (!(canvas instanceof HTMLCanvasElement)) return;
        const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        if (!blob) return;
        const path = await uploadThumbnail(supabase, projectId, blob);
        await saveProjectV2Thumbnail(supabase, projectId, path);
      } catch (err) {
        console.error('[persistenceV2] thumbnail save failed:', err);
      }
    }

    function attachAutosave() {
      let prevProject = useEditorV2Store.getState().project;
      unsubscribe = useEditorV2Store.subscribe((state) => {
        if (state.project === prevProject) return;
        prevProject = state.project;
        if (!state.project) return;
        setStatus('saving');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          void (async () => {
            try {
              const project = useEditorV2Store.getState().project;
              if (!project) return;
              await saveProjectV2Data(supabase, projectId, project);
              await maybeSaveThumbnail();
              if (!cancelled) setStatus('saved');
            } catch (err) {
              console.error('[persistenceV2] autosave failed:', err);
              if (!cancelled) setStatus('error');
            }
          })();
        }, SAVE_DEBOUNCE_MS);
      });
    }

    async function hydrate() {
      useEditorV2Store.getState().loadProject(initialProject);

      const slotIds = new Set<string>();
      initialProject.layers.forEach((l) => {
        if (l.content.kind === 'screenshot') slotIds.add(l.content.slotId);
        if (l.content.kind === 'sticker' && l.content.props.imageSlotId) slotIds.add(l.content.props.imageSlotId);
        if (l.content.kind === 'cutout' && l.content.sourceSlotId) slotIds.add(l.content.sourceSlotId);
      });
      await Promise.all(
        [...slotIds].map(async (slotId) => {
          try {
            const url = await getSignedAssetUrl(supabase, projectId, slotId);
            const img = new Image();
            img.src = url;
            await img.decode();
            if (!cancelled) useEditorV2Store.getState().registerAsset(slotId, img);
          } catch (err) {
            console.error('[persistenceV2] failed to load image asset', slotId, err);
          }
        }),
      );

      await Promise.all(
        initialProject.layers.map(async (l) => {
          if (l.content.kind !== 'video' || !l.content.props.assetId) return;
          try {
            const url = await getSignedAssetUrl(supabase, projectId, l.content.props.assetId);
            if (cancelled) return;
            useEditorV2Store.setState((s) => {
              if (!s.project) return s;
              return {
                project: {
                  ...s.project,
                  layers: s.project.layers.map((layer) => (layer.id === l.id && layer.content.kind === 'video' ? { ...layer, content: { ...layer.content, props: { ...layer.content.props, src: url } } } : layer)),
                },
              };
            });
          } catch (err) {
            console.error('[persistenceV2] failed to load video asset', l.id, err);
          }
        }),
      );

      if (initialProject.musicAssetId) {
        try {
          const url = await getSignedAssetUrl(supabase, projectId, initialProject.musicAssetId);
          const res = await fetch(url);
          const arrayBuffer = await res.arrayBuffer();
          const audioCtx = new AudioContext();
          const buffer = await audioCtx.decodeAudioData(arrayBuffer);
          await audioCtx.close();
          if (!cancelled) {
            useEditorV2Store.getState().setMusic({ buffer, name: initialProject.musicAssetId });
            useEditorV2Store.getState().setMusicVolume(initialProject.musicVolume ?? 0.8);
          }
        } catch (err) {
          console.error('[persistenceV2] failed to load music asset', err);
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
    // Only re-run if pointed at a different project — initialProject only
    // ever seeds the first hydration of this projectId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return status;
}
