'use client';

import { musicClip } from '@/engine/audio/clips';
import { TEXT_ANIMS, TRANSITIONS } from '@/engine/constants';
import type { TextAnim, Transition } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';
import Details from '../ui/Details';
import RangeInput from '../ui/RangeInput';
import SectionLabel from '../ui/SectionLabel';
import SegButtons from '../ui/SegButtons';
import SelectableRow from '../ui/SelectableRow';

// A curated shortcut that sets textAnim + transition together — not a
// replacement for them (both stay independently adjustable in Advanced
// below), since not every existing combination maps to a single named
// preset.
const MOTION_PRESETS: Array<{ id: string; title: string; description: string; textAnim: TextAnim; transition: Transition }> = [
  { id: 'smooth', title: 'Smooth', description: 'Gentle rise-ins with a soft color wipe between slides.', textAnim: 'rise', transition: 'wipe' },
  { id: 'punchy', title: 'Punchy', description: 'Bouncy pop-ins with a bright flash cut.', textAnim: 'pop', transition: 'flash' },
  { id: 'cinematic', title: 'Cinematic', description: 'Letter-by-letter reveals with a blinds transition.', textAnim: 'letters', transition: 'bars' },
  { id: 'snappy', title: 'Snappy', description: 'Quick slide-ins with a circular reveal.', textAnim: 'slide', transition: 'iris' },
];

export default function MotionPanel() {
  const project = useEditorStore((s) => s.project);
  const setTextAnim = useEditorStore((s) => s.setTextAnim);
  const setTransition = useEditorStore((s) => s.setTransition);
  const setMotionSpeed = useEditorStore((s) => s.setMotionSpeed);
  const selectAudio = useEditorStore((s) => s.selectAudio);
  const setMusicDrawerOpen = useEditorStore((s) => s.setMusicDrawerOpen);
  const music = useEditorStore((s) => musicClip(s.project));

  const activePresetId = MOTION_PRESETS.find((p) => p.textAnim === project.textAnim && p.transition === project.transition)?.id ?? null;

  return (
    <div className="grid grid-cols-1 gap-5">
      <p className="rounded-xl border border-[#8b7dff]/[.28] bg-[#5b4bff]/[.1] px-3.5 py-3 text-[12.5px] text-[#cfc8ff]">Defaults for every slide. Override text animation and transition per slide in its Style section.</p>

      <div>
        <SectionLabel>Preset</SectionLabel>
        <div className="grid gap-1.5">
          {MOTION_PRESETS.map((p) => (
            <SelectableRow
              key={p.id}
              radio
              selected={activePresetId === p.id}
              onClick={() => {
                setTextAnim(p.textAnim);
                setTransition(p.transition);
              }}
              title={p.title}
              description={p.description}
            />
          ))}
        </div>
        <Details summary="Advanced: text animation & transition">
          <div className="grid gap-3">
            <div>
              <SectionLabel>Text animation</SectionLabel>
              <SegButtons options={TEXT_ANIMS} value={project.textAnim} onChange={setTextAnim} />
            </div>
            <div>
              <SectionLabel>Transition into each slide</SectionLabel>
              <SegButtons options={TRANSITIONS} value={project.transition} onChange={setTransition} />
            </div>
          </div>
        </Details>
      </div>

      <RangeInput min={60} max={160} step={10} value={project.motionSpeed} onChange={setMotionSpeed} label="Speed" valueLabel={`${(project.motionSpeed / 100).toFixed(1)}×`} />

      <div>
        <SectionLabel>Music</SectionLabel>
        <button
          type="button"
          onClick={() => (music ? selectAudio(music.id) : setMusicDrawerOpen(true))}
          className="w-full rounded-[10px] border border-white/[.08] bg-white/[.03] px-3 py-2.5 text-left text-[13px] text-[#c9cdd8] hover:border-[#8b7dff]/40 hover:bg-[#5b4bff]/[.08]"
        >
          {music ? <>♪ {music.name} <span className="text-[#8b7dff]">· Edit</span></> : <span className="font-semibold">＋ Add music</span>}
        </button>
        <p className="mt-1.5 text-[12px] text-[#767e8d]">Music lives on the timeline, under your slides.</p>
      </div>
    </div>
  );
}
