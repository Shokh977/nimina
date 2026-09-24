'use client';

import { useRef, useState } from 'react';

import type { StorySlide } from '@/engine/types';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { createClient } from '@/lib/supabase/client';
import { uploadAsset } from '@/lib/supabase/storage';
import { useEditorStore } from '@/store/editorStore';

/** The story slide's full/tall screenshots — referenced by id from
 * `showScreen` actions. Order here only affects display; what matters is
 * each screen's stable id. */
export default function ScreensStrip({ slide }: { slide: StorySlide }) {
  const assets = useEditorStore((s) => s.assets);
  const projectId = useEditorStore((s) => s.projectId);
  const registerImage = useEditorStore((s) => s.registerImage);
  const addStoryScreen = useEditorStore((s) => s.addStoryScreen);
  const setStoryScreenAsset = useEditorStore((s) => s.setStoryScreenAsset);
  const removeStoryScreen = useEditorStore((s) => s.removeStoryScreen);
  const moveStoryScreen = useEditorStore((s) => s.moveStoryScreen);
  const addInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [replacingScreenId, setReplacingScreenId] = useState<string | null>(null);

  const loadAndRegister = async (file: File) => {
    const { image } = await loadImageFile(file);
    const assetId = newAssetId('img');
    registerImage(assetId, image);
    if (projectId) uploadAsset(createClient(), projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
    return assetId;
  };

  const onAddFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    addStoryScreen(slide.id, await loadAndRegister(file));
  };

  const onReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !replacingScreenId) return;
    setStoryScreenAsset(slide.id, replacingScreenId, await loadAndRegister(file));
  };

  return (
    <div>
      <h4 className="mb-1.5 text-[12.5px] font-bold text-neutral-500 dark:text-neutral-400">Screens</h4>
      <div className="flex flex-wrap gap-2.5">
        {slide.screens.map((screen, i) => {
          const img = assets.images[screen.assetId];
          return (
            <div key={screen.id} className="w-[84px]">
              <div className="relative overflow-hidden rounded-xl bg-black">
                {img ? (
                  // eslint-disable-next-line @next/next/no-img-element -- in-memory/data-URL asset
                  <img src={assetSrc(img)} alt={`Screen ${i + 1}`} className="h-[130px] w-[84px] object-cover" />
                ) : (
                  <div className="grid h-[130px] w-[84px] place-items-center text-[11px] text-neutral-400">No image</div>
                )}
              </div>
              <p className="mt-1 truncate text-center text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">Screen {i + 1}</p>
              <div className="mt-1 flex justify-center gap-1">
                <button disabled={i === 0} onClick={() => moveStoryScreen(slide.id, screen.id, -1)} aria-label="Move left" className="rounded border border-black/10 bg-white px-1 text-[10.5px] disabled:opacity-35 dark:border-white/10 dark:bg-neutral-800">
                  ←
                </button>
                <button
                  disabled={i === slide.screens.length - 1}
                  onClick={() => moveStoryScreen(slide.id, screen.id, 1)}
                  aria-label="Move right"
                  className="rounded border border-black/10 bg-white px-1 text-[10.5px] disabled:opacity-35 dark:border-white/10 dark:bg-neutral-800"
                >
                  →
                </button>
                <button
                  onClick={() => {
                    setReplacingScreenId(screen.id);
                    replaceInputRef.current?.click();
                  }}
                  className="rounded border border-black/10 bg-white px-1 text-[10.5px] dark:border-white/10 dark:bg-neutral-800"
                >
                  ⟳
                </button>
                <button onClick={() => removeStoryScreen(slide.id, screen.id)} className="rounded border border-black/10 bg-white px-1 text-[10.5px] text-red-600 dark:border-white/10 dark:bg-neutral-800">
                  ✕
                </button>
              </div>
            </div>
          );
        })}
        <button
          onClick={() => addInputRef.current?.click()}
          className="grid h-[130px] w-[84px] place-items-center rounded-xl border border-dashed border-black/15 bg-white text-[12px] font-bold hover:border-indigo-500 dark:border-white/15 dark:bg-neutral-800"
        >
          + Add
        </button>
        <input ref={addInputRef} type="file" accept="image/*" className="hidden" onChange={onAddFile} />
        <input ref={replaceInputRef} type="file" accept="image/*" className="hidden" onChange={onReplaceFile} />
      </div>
      <p className="mt-1.5 text-[12px] text-neutral-500 dark:text-neutral-400">Full, tall screenshots — a `Show screen` action can scroll through any of them.</p>
    </div>
  );
}
