'use client';

import { useRef } from 'react';

import { resolveStyle } from '@/engine/render';
import { getStoryTimeline } from '@/engine/story';
import type { Slide } from '@/engine/types';
import { loadImageFile, newAssetId } from '@/lib/assetSrc';
import StorageMeter from '@/components/storage/StorageMeter';
import { rejectUpload, uploadAsset } from '@/lib/storage/assets';
import { useEditorStore } from '@/store/editorStore';
import { usePlayback } from './PlaybackContext';
import SectionLabel from './ui/SectionLabel';

function rawDuration(s: Slide): number {
  return s.kind === 'story' ? getStoryTimeline(s).total : s.dur;
}

function slideName(s: Slide, i: number): string {
  if (s.kind === 'story') return `Story ${i + 1}`;
  return s.headline.replace(/\*/g, '') || (s.kind === 'text' ? `Text ${i + 1}` : `Slide ${i + 1}`);
}

function Row({ selected, hidden, colorA, colorB, name, duration, onSelect, onToggleVisible, visibleTitle }: { selected: boolean; hidden: boolean; colorA: string; colorB: string; name: string; duration: number; onSelect: () => void; onToggleVisible?: () => void; visibleTitle?: string }) {
  return (
    <div className="relative">
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-[9px] rounded-[11px] border py-2 pr-8 pl-2 text-left transition-colors duration-[.16s] ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${
          selected ? 'border-[#8b7dff]/55 bg-[#5b4bff]/[.14]' : 'border-white/10 bg-white/[.03] hover:bg-white/[.06]'
        }`}
      >
        <span className="h-full min-h-[30px] w-[5px] shrink-0 self-stretch rounded-full" style={{ background: `linear-gradient(150deg, ${colorA}, ${colorB})` }} />
        <span className="min-w-0 flex-1">
          <span className={`block text-[12.5px] leading-[1.25] font-semibold break-words ${hidden ? 'text-[#6d7484]' : 'text-[#f4f5f8]'}`}>{name}</span>
          <span className="mt-0.5 block text-[11px] text-[#767e8d]">{duration.toFixed(1)}s</span>
        </span>
      </button>
      {onToggleVisible && (
        <button
          onClick={onToggleVisible}
          title={visibleTitle}
          aria-label={visibleTitle}
          className="absolute top-[7px] right-[5px] grid h-6 w-6 place-items-center rounded-[8px] text-[13px] transition-colors duration-[.16s] hover:bg-white/[.1]"
        >
          <span className={hidden ? 'text-[#5f6675]' : 'text-[#9aa1af]'}>{hidden ? '◌' : '👁'}</span>
        </button>
      )}
    </div>
  );
}

export default function SlideRail() {
  const project = useEditorStore((s) => s.project);
  const selectedSceneId = useEditorStore((s) => s.selectedSceneId);
  const selectScene = useEditorStore((s) => s.selectScene);
  const updateSlide = useEditorStore((s) => s.updateSlide);
  const setIntro = useEditorStore((s) => s.setIntro);
  const setOutro = useEditorStore((s) => s.setOutro);
  const registerImage = useEditorStore((s) => s.registerImage);
  const addImageSlide = useEditorStore((s) => s.addImageSlide);
  const addTextSlide = useEditorStore((s) => s.addTextSlide);
  const addStorySlide = useEditorStore((s) => s.addStorySlide);
  const projectId = useEditorStore((s) => s.projectId);
  const { seek } = usePlayback();

  const addInputRef = useRef<HTMLInputElement>(null);

  const onAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    for (const file of files) {
      if (rejectUpload(file, projectId)) continue;
      try {
        const { image } = await loadImageFile(file);
        const assetId = newAssetId('img');
        registerImage(assetId, image);
        addImageSlide(assetId);
        if (projectId) uploadAsset(projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
      } catch {
        // skip files that fail to decode
      }
    }
  };

  const introStyle = resolveStyle(project, project.intro);
  const outroStyle = resolveStyle(project, project.outro);

  // Precomputed (not mutated during the JSX map below) so each row knows
  // where its slide starts in the timeline, for seeking on select.
  const rows: Array<{ slide: Slide; index: number; startAt: number }> = [];
  let cursor = project.intro.on ? project.intro.dur : 0;
  project.scenes.forEach((slide, index) => {
    rows.push({ slide, index, startAt: cursor });
    if (!slide.hidden) cursor += rawDuration(slide);
  });
  const outroStartAt = cursor;

  return (
    <div className="flex h-full flex-col p-3">
      <SectionLabel>Slides</SectionLabel>
      <div className="flex flex-col gap-2 overflow-y-auto">
        <Row
          selected={selectedSceneId === 'intro'}
          hidden={!project.intro.on}
          colorA={introStyle.colors.a}
          colorB={introStyle.colors.b}
          name="Intro"
          duration={project.intro.dur}
          onSelect={() => {
            selectScene('intro');
            seek(0);
          }}
          onToggleVisible={() => setIntro({ on: !project.intro.on })}
          visibleTitle={project.intro.on ? 'Hide intro' : 'Show intro'}
        />

        {rows.map(({ slide, index, startAt }) => {
          const style = resolveStyle(project, slide);
          return (
            <Row
              key={slide.id}
              selected={selectedSceneId === slide.id}
              hidden={slide.hidden}
              colorA={style.colors.a}
              colorB={style.colors.b}
              name={slideName(slide, index)}
              duration={rawDuration(slide)}
              onSelect={() => {
                selectScene(slide.id);
                if (!slide.hidden) seek(startAt);
              }}
              onToggleVisible={() => updateSlide(slide.id, { hidden: !slide.hidden })}
              visibleTitle={slide.hidden ? 'Show slide' : 'Hide slide'}
            />
          );
        })}

        <Row
          selected={selectedSceneId === 'outro'}
          hidden={!project.outro.on}
          colorA={outroStyle.colors.a}
          colorB={outroStyle.colors.b}
          name="Outro"
          duration={project.outro.dur}
          onSelect={() => {
            selectScene('outro');
            seek(Math.max(0, outroStartAt));
          }}
          onToggleVisible={() => setOutro({ on: !project.outro.on })}
          visibleTitle={project.outro.on ? 'Hide outro' : 'Show outro'}
        />
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <button
          onClick={() => addInputRef.current?.click()}
          className="rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08] hover:text-white"
        >
          ＋ Add screenshot
        </button>
        <button
          onClick={() => addTextSlide()}
          className="rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08] hover:text-white"
        >
          ＋ Add text slide
        </button>
        <button
          onClick={() => addStorySlide()}
          className="rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08] hover:text-white"
        >
          ＋ Add story slide
        </button>
        <input ref={addInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onAddFiles} />
      </div>

      <div className="mt-auto pt-3">
        {projectId && (
          <div className="mb-3 rounded-xl border border-white/[.07] bg-white/[.03] p-3">
            <StorageMeter compact />
          </div>
        )}
        <div className="rounded-xl border border-white/[.07] bg-white/[.03] p-3 text-[12px] leading-[1.45] text-[#767e8d]">
          Wrap words in <span className="font-[family-name:var(--font-space-grotesk)] text-[#cfc8ff]">*stars*</span> to highlight them.
        </div>
      </div>
    </div>
  );
}
