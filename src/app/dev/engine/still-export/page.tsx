'use client';

import { useEffect, useState } from 'react';

import ImageExportPanel from '@/components/editor/panels/ImageExportPanel';
import { exportVideo, renderStillBlob, stillTimeFor } from '@/engine/export';
import { createDefaultProject } from '@/engine/project';
import type { Format, ImageSlide } from '@/engine/types';
import { loadImageFile, newAssetId } from '@/lib/assetSrc';
import type { Plan } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';

/** Copy per uploaded screenshot, chosen to exercise the still layout:
 * subtitle + badge, a fan layout with a callout, a pop entrance, and a
 * long headline that has to wrap. */
const SLIDE_COPY: Array<Partial<ImageSlide>> = [
  { headline: 'Make promo videos *in minutes*', sub: 'Upload screenshots, pick a style, export.', badge: 'NEW' },
  { headline: 'Simple, honest *pricing*', callout: 'Pick a plan', layout: 'fan' },
  { headline: 'Sign in with *one tap*', anim: 'pop' },
  { headline: 'Every store size you need, rendered sharp and *ready to upload*', sub: 'iPhone, iPad and Android.' },
];

/**
 * Dev harness for the store-screenshot export: real uploaded image files
 * go through the same loadImageFile/registerImage/addImageSlide path as
 * the editor's slide rail, then the real ImageExportPanel renders/exports
 * them. Exists so the export can be driven end to end (Playwright) without
 * a signed-in Supabase session; nothing here is persisted.
 */
export default function StillExportHarness() {
  const [plan, setPlan] = useState<Plan>('pro');
  const sceneCount = useEditorStore((s) => s.project.scenes.length);

  useEffect(() => {
    useEditorStore.getState().loadProject({ ...createDefaultProject(), appName: 'Nimina', preset: 5, colors: { a: '#8B5CF6', b: '#3B0F7A', text: '#FFFFFF', accent: '#F9A8D4' } }, null);
  }, []);
  useEffect(() => {
    useEditorStore.getState().setPlan(plan);
  }, [plan]);
  useEffect(() => {
    // Playwright hooks: a still of slide `i` at any size, or a frame decoded
    // back from a real video export of just that slide in any format.
    const toDataUrl = (b: Blob) => new Promise<string>((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b); });
    Object.assign(window, {
      __still: async (i: number, w: number, h: number, patch?: Partial<ImageSlide>) => {
        const { project, assets } = useEditorStore.getState();
        const scenes = project.scenes.map((s, k) => (k === i && patch ? ({ ...s, ...patch } as typeof s) : s));
        const p = { ...project, scenes };
        return toDataUrl(await renderStillBlob(p, assets.images, scenes[i].id, stillTimeFor(p, scenes[i]), w, h, { format: 'png', quality: 1, watermark: false }));
      },
      __videoFrame: async (i: number, format: Format) => {
        const { project, assets } = useEditorStore.getState();
        const s = project.scenes[i];
        const p = { ...project, format, intro: { ...project.intro, on: false }, outro: { ...project.outro, on: false }, scenes: project.scenes.map((x) => ({ ...x, hidden: x.id !== s.id })) };
        const out = await exportVideo(p, assets.images, {}, { resolution: '1080p' }, new AbortController().signal);
        const video = document.createElement('video');
        video.src = out.url;
        video.muted = true;
        await new Promise((r) => (video.onloadedmetadata = r));
        video.currentTime = stillTimeFor(p, s);
        await new Promise((r) => (video.onseeked = r));
        const c = document.createElement('canvas');
        c.width = video.videoWidth;
        c.height = video.videoHeight;
        c.getContext('2d')!.drawImage(video, 0, 0);
        return c.toDataURL('image/png');
      },
    });
  }, []);

  const onFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const { registerImage, addImageSlide } = useEditorStore.getState();
    for (const [i, file] of files.entries()) {
      const { image } = await loadImageFile(file);
      const assetId = newAssetId('img');
      registerImage(assetId, image);
      addImageSlide(assetId, SLIDE_COPY[i % SLIDE_COPY.length]);
    }
  };

  return (
    <div className="mx-auto grid max-w-[460px] gap-4 p-4 text-[#f4f5f8]" style={{ background: '#08090c', minHeight: '100vh' }}>
      <div className="flex items-center gap-3">
        <input data-testid="upload" type="file" accept="image/*" multiple onChange={onFiles} />
        {(['free', 'pro'] as const).map((p) => (
          <button key={p} data-testid={`plan-${p}`} onClick={() => setPlan(p)} className={`rounded px-2 py-1 text-sm ${plan === p ? 'bg-[#5b4bff]' : 'bg-white/10'}`}>
            {p}
          </button>
        ))}
      </div>
      {sceneCount > 0 && <ImageExportPanel key={`${plan}-${sceneCount}`} />}
    </div>
  );
}
