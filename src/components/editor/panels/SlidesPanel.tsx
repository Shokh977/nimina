'use client';

import { useRef } from 'react';

import { DURS } from '@/engine/constants';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { uploadAsset } from '@/lib/storage/assets';
import { useEditorStore } from '@/store/editorStore';
import { usePlayback } from '../PlaybackContext';
import StyleEditor from '../StyleEditor';
import { KEYS_IO } from '../styleFields';
import { segStartOf } from '../timelineHelpers';
import SectionLabel from '../ui/SectionLabel';
import SegmentedControl from '../ui/SegmentedControl';
import SceneCard from './SceneCard';

const INPUT_CLASS = 'block h-10 w-full rounded-[10px] border border-white/[.12] bg-white/[.03] px-3 text-[13.5px] text-[#f4f5f8] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]';
const DUR_OPTIONS: Array<[string, string]> = DURS.map((d) => [String(d), `${d}s`]);

/** The Inspector's Slide tab — shows the editor for whichever slide is
 * selected in SlideRail (Intro/Outro's own fields, or SceneCard for a
 * scene). Used to be "every slide, always inline"; now single-slide, per
 * the new fixed-height shell's rail/detail split. */
export default function SlidesPanel() {
  const project = useEditorStore((s) => s.project);
  const assets = useEditorStore((s) => s.assets);
  const projectId = useEditorStore((s) => s.projectId);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const setAppName = useEditorStore((s) => s.setAppName);
  const setIntro = useEditorStore((s) => s.setIntro);
  const setIntroStyle = useEditorStore((s) => s.setIntroStyle);
  const resetIntroStyle = useEditorStore((s) => s.resetIntroStyle);
  const setOutro = useEditorStore((s) => s.setOutro);
  const setOutroStyle = useEditorStore((s) => s.setOutroStyle);
  const resetOutroStyle = useEditorStore((s) => s.resetOutroStyle);
  const setIcon = useEditorStore((s) => s.setIcon);
  const clearIcon = useEditorStore((s) => s.clearIcon);
  const { seek, playFrom } = usePlayback();

  const iconInputRef = useRef<HTMLInputElement>(null);

  const introSeek = () => {
    if (project.intro.on) seek(Math.min(project.intro.dur - 0.5, 2));
  };
  const outroSeek = () => {
    if (project.outro.on) seek(segStartOf(project, project.outro) + Math.max(0, project.outro.dur - 0.6));
  };

  const onIconFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const { image } = await loadImageFile(file);
    const assetId = newAssetId('icon');
    setIcon(assetId, image);
    if (projectId) uploadAsset(projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
    introSeek();
  };

  const iconImg = project.iconAssetId ? assets.images[project.iconAssetId] : null;

  if (selectedSceneId === 'intro') {
    return (
      <div className="grid grid-cols-1 gap-5">
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <SectionLabel>App name</SectionLabel>
            <input type="text" value={project.appName} onChange={(e) => setAppName(e.target.value)} onFocus={introSeek} className={INPUT_CLASS} />
          </label>
          <div>
            <SectionLabel>Length</SectionLabel>
            <SegmentedControl scroll options={DUR_OPTIONS} value={String(project.intro.dur)} onChange={(v) => setIntro({ dur: Number(v) })} />
          </div>
        </div>
        <label className="block">
          <SectionLabel>Tagline</SectionLabel>
          <input type="text" value={project.intro.tagline} onChange={(e) => setIntro({ tagline: e.target.value })} onFocus={introSeek} className={INPUT_CLASS} />
        </label>
        <div className="flex flex-wrap items-center gap-2.5">
          <button onClick={() => iconInputRef.current?.click()} className="rounded-[10px] border border-white/[.16] bg-white/[.03] px-3.5 py-2 text-[13px] font-semibold text-[#f4f5f8] hover:bg-white/[.08]">
            {project.iconAssetId ? 'Change app icon' : 'Upload app icon'}
          </button>
          {project.iconAssetId && (
            <button onClick={clearIcon} className="text-[13px] font-semibold text-[#8b7dff] hover:text-[#a89bff]">
              Remove icon
            </button>
          )}
          {iconImg && (
            // eslint-disable-next-line @next/next/no-img-element -- in-memory data-URL asset
            <img src={assetSrc(iconImg)} alt="" className="h-8 w-8 rounded-lg object-cover" />
          )}
          <input ref={iconInputRef} type="file" accept="image/*" className="hidden" onChange={onIconFile} />
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
    );
  }

  if (selectedSceneId === 'outro') {
    return (
      <div className="grid grid-cols-1 gap-5">
        <label className="block">
          <SectionLabel>Closing line</SectionLabel>
          <input type="text" value={project.outro.cta} onChange={(e) => setOutro({ cta: e.target.value })} onFocus={outroSeek} className={INPUT_CLASS} />
        </label>
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <SectionLabel>Button text</SectionLabel>
            <input type="text" value={project.outro.button} onChange={(e) => setOutro({ button: e.target.value })} onFocus={outroSeek} className={INPUT_CLASS} />
          </label>
          <div>
            <SectionLabel>Length</SectionLabel>
            <SegmentedControl scroll options={DUR_OPTIONS} value={String(project.outro.dur)} onChange={(v) => setOutro({ dur: Number(v) })} />
          </div>
        </div>
        <label className="block">
          <SectionLabel>Small print</SectionLabel>
          <input type="text" value={project.outro.small} onChange={(e) => setOutro({ small: e.target.value })} onFocus={outroSeek} className={INPUT_CLASS} />
        </label>
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
    );
  }

  const index = project.scenes.findIndex((s) => s.id === selectedSceneId);
  if (index < 0) {
    return (
      <div className="grid place-items-center py-10 text-center">
        <p className="text-[13.5px] font-semibold text-[#f4f5f8]">No slide selected</p>
        <p className="mt-1 text-[12.5px] text-[#767e8d]">Pick a slide from the rail on the left.</p>
      </div>
    );
  }

  return <SceneCard slide={project.scenes[index]} index={index} count={project.scenes.length} />;
}
