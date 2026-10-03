'use client';

import type { AssetMap, Project } from '@/engine/types';
import { loadImageFile, newAssetId } from '@/lib/assetSrc';
import { rejectUpload, uploadAsset } from '@/lib/storage/assets';
import { useEditorStore } from '@/store/editorStore';

/** A place a screenshot goes: an image slide's screen, or one screen of a story slide. */
export type ScreenTarget = { slideId: number; screenId?: string };

/**
 * Every screen in the project with no screenshot to show — image slides
 * with none assigned, and story screens whose file isn't there (a template
 * slot left empty keeps the template's sample id, which no project has).
 * While the project's files are still loading nothing counts as missing.
 */
export function missingScreens(project: Project, images: AssetMap, ready: boolean): ScreenTarget[] {
  const out: ScreenTarget[] = [];
  for (const s of project.scenes) {
    if (s.kind === 'image' && (!s.imgAssetId || (ready && !images[s.imgAssetId]))) out.push({ slideId: s.id });
    if (s.kind === 'story' && ready) for (const sc of s.screens) if (!images[sc.assetId]) out.push({ slideId: s.id, screenId: sc.id });
  }
  return out;
}

export const sameTarget = (a: ScreenTarget, b: ScreenTarget) => a.slideId === b.slideId && a.screenId === b.screenId;

/**
 * Putting screenshots into existing slides: one file into one place
 * (`put`), or several files into the empty places in slide order
 * (`fillMissing`). Each file is shown at once and uploaded in the
 * background, like any other screenshot.
 */
export function useScreenshots() {
  const projectId = useEditorStore((s) => s.projectId);

  const load = async (file: File): Promise<string | null> => {
    if (rejectUpload(file, projectId)) return null;
    try {
      const { image } = await loadImageFile(file);
      const assetId = newAssetId('img');
      useEditorStore.getState().registerImage(assetId, image);
      if (projectId) uploadAsset(projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
      return assetId;
    } catch {
      return null;
    }
  };

  const assign = (target: ScreenTarget, assetId: string) => {
    const st = useEditorStore.getState();
    if (target.screenId) st.setStoryScreenAsset(target.slideId, target.screenId, assetId);
    else st.replaceSlideImage(target.slideId, assetId, st.assets.images[assetId]);
  };

  const put = async (target: ScreenTarget, file: File) => {
    const id = await load(file);
    if (id) assign(target, id);
  };

  /** Fills the empty screens in order; returns how many were filled. */
  const fillMissing = async (files: File[]) => {
    const st = useEditorStore.getState();
    const targets = missingScreens(st.project, st.assets.images, st.assetsReady);
    let n = 0;
    for (const file of files) {
      const target = targets[n];
      if (!target) break;
      const id = await load(file);
      if (id) {
        assign(target, id);
        n++;
      }
    }
    return n;
  };

  return { put, fillMissing };
}

/** The image files in a drag-and-drop, if any. */
export function droppedImages(e: React.DragEvent): File[] {
  return [...(e.dataTransfer?.files ?? [])].filter((f) => f.type.startsWith('image/'));
}
