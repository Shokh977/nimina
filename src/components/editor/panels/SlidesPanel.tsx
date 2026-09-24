'use client';

import { useRef } from 'react';

import { DURS } from '@/engine/constants';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { createClient } from '@/lib/supabase/client';
import { uploadAsset } from '@/lib/supabase/storage';
import { useEditorStore } from '@/store/editorStore';
import { usePlayback } from '../PlaybackContext';
import StyleEditor from '../StyleEditor';
import { KEYS_IO } from '../styleFields';
import { segStartOf } from '../timelineHelpers';
import SceneCard from './SceneCard';

export default function SlidesPanel() {
  const project = useEditorStore((s) => s.project);
  const assets = useEditorStore((s) => s.assets);
  const projectId = useEditorStore((s) => s.projectId);
  const setAppName = useEditorStore((s) => s.setAppName);
  const setIntro = useEditorStore((s) => s.setIntro);
  const setIntroStyle = useEditorStore((s) => s.setIntroStyle);
  const resetIntroStyle = useEditorStore((s) => s.resetIntroStyle);
  const setOutro = useEditorStore((s) => s.setOutro);
  const setOutroStyle = useEditorStore((s) => s.setOutroStyle);
  const resetOutroStyle = useEditorStore((s) => s.resetOutroStyle);
  const setIcon = useEditorStore((s) => s.setIcon);
  const clearIcon = useEditorStore((s) => s.clearIcon);
  const registerImage = useEditorStore((s) => s.registerImage);
  const addImageSlide = useEditorStore((s) => s.addImageSlide);
  const addTextSlide = useEditorStore((s) => s.addTextSlide);
  const addStorySlide = useEditorStore((s) => s.addStorySlide);
  const { seek, playFrom } = usePlayback();

  const addInputRef = useRef<HTMLInputElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const introSeek = () => {
    if (project.intro.on) seek(Math.min(project.intro.dur - 0.5, 2));
  };
  const outroSeek = () => {
    if (project.outro.on) seek(segStartOf(project, project.outro) + Math.max(0, project.outro.dur - 0.6));
  };

  const onAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    let firstId: number | null = null;
    for (const file of files) {
      try {
        const { image } = await loadImageFile(file);
        const assetId = newAssetId('img');
        registerImage(assetId, image);
        const id = Number(addImageSlide(assetId));
        if (firstId === null) firstId = id;
        if (projectId) uploadAsset(createClient(), projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
      } catch {
        // skip files that fail to decode
      }
    }
    if (firstId !== null) seek(1.4);
  };

  const onIconFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { image } = await loadImageFile(file);
    const assetId = newAssetId('icon');
    setIcon(assetId, image);
    if (projectId) uploadAsset(createClient(), projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
    introSeek();
  };

  const iconImg = project.iconAssetId ? assets.images[project.iconAssetId] : null;

  return (
    <div>
      {/* Opening */}
      <div className="mb-3 rounded-2xl bg-neutral-100 p-3.5 dark:bg-neutral-800/60">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="m-0 text-[15px] font-bold">Opening</h3>
          <label className="flex items-center gap-2 text-[13.5px] font-semibold">
            <input type="checkbox" checked={project.intro.on} onChange={(e) => setIntro({ on: e.target.checked })} className="h-[18px] w-[18px] accent-indigo-600" />
            Show
          </label>
        </div>
        <div className="grid gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <Labeled label="App name">
              <input
                type="text"
                value={project.appName}
                onChange={(e) => setAppName(e.target.value)}
                onFocus={introSeek}
                className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
              />
            </Labeled>
            <Labeled label="Length">
              <select
                value={project.intro.dur}
                onChange={(e) => setIntro({ dur: Number(e.target.value) })}
                className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
              >
                {DURS.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </Labeled>
          </div>
          <Labeled label="Tagline">
            <input
              type="text"
              value={project.intro.tagline}
              onChange={(e) => setIntro({ tagline: e.target.value })}
              onFocus={introSeek}
              className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
            />
          </Labeled>
          <div className="flex flex-wrap items-center gap-2.5">
            <button onClick={() => iconInputRef.current?.click()} className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-[13px] font-semibold dark:border-white/10 dark:bg-neutral-800">
              {project.iconAssetId ? 'Change app icon' : 'Upload app icon'}
            </button>
            {project.iconAssetId && (
              <button onClick={clearIcon} className="text-[13px] font-bold text-indigo-600 dark:text-indigo-400">
                Remove icon
              </button>
            )}
            {iconImg && (
              // eslint-disable-next-line @next/next/no-img-element -- in-memory data-URL asset
              <img src={assetSrc(iconImg)} alt="" className="h-8 w-8 rounded-lg object-cover" />
            )}
            <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={onIconFile} />
          </div>
        </div>
        <StyleEditor
          title="Style for this slide"
          keys={KEYS_IO}
          style={project.intro.style}
          onChange={(key, value) => {
            setIntroStyle(key, value);
            playFrom(key === 'transition' ? Math.max(0, segStartOf(project, project.intro) - 0.7) : segStartOf(project, project.intro));
          }}
          onReset={resetIntroStyle}
        />
      </div>

      <p className="mb-2.5 text-[12.5px] text-neutral-500 dark:text-neutral-400">
        Wrap words in <code className="rounded bg-neutral-200 px-1 py-0.5 dark:bg-neutral-700">*stars*</code> to highlight them. Open a slide&apos;s <b>Style</b> section to give it its own look.
      </p>

      {project.scenes.map((slide, i) => (
        <SceneCard key={slide.id} slide={slide} index={i} count={project.scenes.length} />
      ))}

      <div className="flex gap-2">
        <button
          onClick={() => addInputRef.current?.click()}
          className="flex-1 rounded-xl border border-dashed border-black/15 bg-white px-4 py-3.5 text-center font-bold hover:border-indigo-500 dark:border-white/15 dark:bg-neutral-800"
        >
          Add screenshots
        </button>
        <button
          onClick={() => addTextSlide()}
          className="flex-1 rounded-xl border border-dashed border-black/15 bg-white px-4 py-3.5 text-center font-bold hover:border-indigo-500 dark:border-white/15 dark:bg-neutral-800"
        >
          Add text slide
        </button>
        <button
          onClick={() => addStorySlide()}
          className="flex-1 rounded-xl border border-dashed border-black/15 bg-white px-4 py-3.5 text-center font-bold hover:border-indigo-500 dark:border-white/15 dark:bg-neutral-800"
        >
          Add story slide
        </button>
        <input ref={addInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onAddFiles} />
      </div>
      <p className="mt-2 text-[12.5px] text-neutral-500 dark:text-neutral-400">
        Each screenshot becomes one slide. Text slides are big statements between screens. Story slides are one continuous phone shot driven by a list of actions — tap, scroll, launch, notify.
      </p>

      {/* Ending */}
      <div className="mt-3.5 rounded-2xl bg-neutral-100 p-3.5 dark:bg-neutral-800/60">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h3 className="m-0 text-[15px] font-bold">Ending</h3>
          <label className="flex items-center gap-2 text-[13.5px] font-semibold">
            <input type="checkbox" checked={project.outro.on} onChange={(e) => setOutro({ on: e.target.checked })} className="h-[18px] w-[18px] accent-indigo-600" />
            Show
          </label>
        </div>
        <div className="grid gap-2.5">
          <Labeled label="Closing line">
            <input
              type="text"
              value={project.outro.cta}
              onChange={(e) => setOutro({ cta: e.target.value })}
              onFocus={outroSeek}
              className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
            />
          </Labeled>
          <div className="grid grid-cols-2 gap-2.5">
            <Labeled label="Button text">
              <input
                type="text"
                value={project.outro.button}
                onChange={(e) => setOutro({ button: e.target.value })}
                onFocus={outroSeek}
                className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
              />
            </Labeled>
            <Labeled label="Length">
              <select
                value={project.outro.dur}
                onChange={(e) => setOutro({ dur: Number(e.target.value) })}
                className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
              >
                {DURS.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </Labeled>
          </div>
          <Labeled label="Small print">
            <input
              type="text"
              value={project.outro.small}
              onChange={(e) => setOutro({ small: e.target.value })}
              onFocus={outroSeek}
              className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
            />
          </Labeled>
        </div>
        <StyleEditor
          title="Style for this slide"
          keys={KEYS_IO}
          style={project.outro.style}
          onChange={(key, value) => {
            setOutroStyle(key, value);
            playFrom(key === 'transition' ? Math.max(0, segStartOf(project, project.outro) - 0.7) : segStartOf(project, project.outro));
          }}
          onReset={resetOutroStyle}
        />
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
      {label}
      {children}
    </label>
  );
}
