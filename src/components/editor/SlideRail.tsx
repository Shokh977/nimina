'use client';

import StorageMeter from '@/components/storage/StorageMeter';
import { useEditorStore } from '@/store/editorStore';
import SectionLabel from './ui/SectionLabel';
import { useAddSlides, useSlideEntries } from './useSlideList';

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
  const projectId = useEditorStore((s) => s.projectId);
  const entries = useSlideEntries();
  const { inputRef, onAddFiles, pickScreenshots, addTextSlide, addStorySlide, videoInputRef, onAddRecording, pickRecording, videoStatus } = useAddSlides();

  return (
    <div className="flex h-full flex-col p-3">
      <SectionLabel>Slides</SectionLabel>
      <div className="flex flex-col gap-2 overflow-y-auto">
        {entries.map((e) => (
          <Row
            key={e.key}
            selected={e.selected}
            hidden={e.hidden}
            colorA={e.colorA}
            colorB={e.colorB}
            name={e.name}
            duration={e.duration}
            onSelect={e.onSelect}
            onToggleVisible={e.onToggleVisible}
            visibleTitle={e.visibleTitle}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        <button
          onClick={pickScreenshots}
          className="rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08] hover:text-white"
        >
          ＋ Add screenshot
        </button>
        <button
          onClick={pickRecording}
          className="rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08] hover:text-white"
        >
          ＋ Add screen recording
        </button>
        {videoStatus && <p className="px-1 text-[12px] leading-snug text-[#c9cdd8]">{videoStatus}</p>}
        <button
          onClick={addTextSlide}
          className="rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08] hover:text-white"
        >
          ＋ Add text slide
        </button>
        <button
          onClick={addStorySlide}
          className="rounded-[10px] border border-dashed border-white/[.18] bg-white/[.02] px-3 py-2.5 text-[12.5px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.08] hover:text-white"
        >
          ＋ Add story slide
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={onAddFiles} />
        <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="hidden" onChange={onAddRecording} />
      </div>

      <div className="mt-auto pt-3">
        {/* Only when storage is nearly full — otherwise it's in the account menu. */}
        {projectId && <StorageMeter compact onlyNearLimit wrapperClassName="mb-3 rounded-xl border border-white/[.07] bg-white/[.03] p-3" />}
        <div className="rounded-xl border border-white/[.07] bg-white/[.03] p-3 text-[12px] leading-[1.45] text-[#767e8d]">
          Wrap words in <span className="font-[family-name:var(--font-space-grotesk)] text-[#cfc8ff]">*stars*</span> to highlight them.
        </div>
      </div>
    </div>
  );
}
