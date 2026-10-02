'use client';

import { useEffect, useState } from 'react';

import { EditorShellBody } from '@/components/editor/EditorShell';
import ExportPanel from '@/components/editor/panels/ExportPanel';
import LanguagesPanel from '@/components/editor/panels/LanguagesPanel';
import { checkHighlights, localizeProject } from '@/engine/localization';
import { createDefaultProject } from '@/engine/project';
import { render } from '@/engine/render';
import { segmentUnspaced } from '@/engine/text';
import type { ImageSlide } from '@/engine/types';
import { loadImageFile, newAssetId } from '@/lib/assetSrc';
import type { Plan } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';

const SLIDE_COPY: Array<Partial<ImageSlide>> = [
  { headline: 'Make promo videos *in minutes*', sub: 'Upload screenshots, pick a style, export.', badge: 'NEW' },
  { headline: 'Simple, honest *pricing*', callout: 'Pick a plan', layout: 'fan' },
  { headline: 'Sign in with *one tap*', anim: 'pop' },
  { headline: 'Every store size you need, rendered sharp and *ready to upload*', sub: 'iPhone, iPad and Android.' },
];

/**
 * Localization harness: the real editor shell (stage + language switcher,
 * Languages and Export panels) over a project built from uploaded
 * screenshots — without usePersistence, so nothing is saved anywhere. The
 * plan can be switched to exercise gating. window hooks let Playwright
 * read the store and render frames for inspection.
 */
export default function LocalizationHarness() {
  const [plan, setPlan] = useState<Plan>('pro');
  const [tab, setTab] = useState<'languages' | 'export'>('languages');
  const sceneCount = useEditorStore((s) => s.project.scenes.length);

  useEffect(() => {
    useEditorStore.getState().loadProject(
      {
        ...createDefaultProject(),
        appName: 'Nimina',
        preset: 5,
        colors: { a: '#8B5CF6', b: '#3B0F7A', text: '#FFFFFF', accent: '#F9A8D4' },
        intro: { on: true, dur: 2.5, tagline: 'Promo videos for your app', style: {} },
        outro: { on: true, dur: 3, cta: 'Launch your app *today*', button: 'Download free', small: 'Free on iOS and Android', style: {} },
      },
      null,
    );
    Object.assign(window, {
      __store: useEditorStore,
      __segment: segmentUnspaced,
      __checkHighlights: checkHighlights,
      // A frame of the project in `locale` at time t, at `format`'s 1080p size.
      __frame: (locale: string, t: number, format?: '9:16' | '16:9' | '1:1') => {
        const p = localizeProject(useEditorStore.getState().project, locale);
        const proj = format ? { ...p, format } : p;
        const c = document.createElement('canvas');
        const [w, h] = proj.format === '16:9' ? [1920, 1080] : proj.format === '1:1' ? [1080, 1080] : [1080, 1920];
        c.width = w;
        c.height = h;
        render(c.getContext('2d')!, proj, useEditorStore.getState().assets.images, t, 1);
        return c.toDataURL('image/png');
      },
    });
  }, []);
  useEffect(() => {
    useEditorStore.getState().setPlan(plan);
  }, [plan]);

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
    <>
      <div className="fixed bottom-2 left-2 z-50 flex items-center gap-2 rounded bg-black/80 p-2 text-xs text-white">
        <input data-testid="upload" type="file" accept="image/*" multiple onChange={onFiles} />
        {(['free', 'pro'] as const).map((p) => (
          <button key={p} data-testid={`plan-${p}`} onClick={() => setPlan(p)} className={`rounded px-2 py-1 ${plan === p ? 'bg-[#5b4bff]' : 'bg-white/10'}`}>
            {p}
          </button>
        ))}
      </div>
      <EditorShellBody userEmail="harness@local" projectName="Localization harness" saveStatus="saved" onExportClick={() => setTab('export')}>
        <div role="tablist" className="flex gap-1 border-b border-white/[.07] p-2 pb-0">
          {(['languages', 'export'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="flex-1 rounded-[9px] px-1.5 py-[9px] text-[13px] font-semibold text-[#9aa1af] capitalize aria-selected:bg-[#5b4bff]/[.18] aria-selected:text-[#cfc8ff]">
              {t}
            </button>
          ))}
        </div>
        <div className="min-w-0 flex-1 overflow-y-auto p-4" key={sceneCount}>
          {tab === 'languages' ? <LanguagesPanel /> : <ExportPanel />}
        </div>
      </EditorShellBody>
    </>
  );
}
