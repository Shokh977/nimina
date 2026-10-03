'use client';

import { TEXT_ANIMS, TRANSITIONS } from '@/engine/constants';
import type { TextAnim, Transition } from '@/engine/types';
import { useEditorStore } from '@/store/editorStore';
import MusicSection from './MusicSection';
import Details from '../ui/Details';
import RangeInput from '../ui/RangeInput';
import SectionLabel from '../ui/SectionLabel';
import SegButtons from '../ui/SegButtons';
import SelectableRow from '../ui/SelectableRow';
import ToggleRow from '../ui/ToggleRow';

let sharedAudioCtx: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
  return sharedAudioCtx;
}

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
  const setVolume = useEditorStore((s) => s.setVolume);
  const setDucking = useEditorStore((s) => s.setDucking);

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
        <MusicSection getAudioContext={getAudioContext} />
        <div className="mt-3">
          <RangeInput min={0} max={1} step={0.05} value={project.volume} onChange={setVolume} label="Volume" />
        </div>
        <p className="mt-1.5 text-[12px] text-[#767e8d]">The track loops if it&apos;s shorter than the video and fades out at the end.</p>
        <div className="mt-2.5">
          <ToggleRow title="Duck under story sound effects" sub="Briefly lowers the music whenever a story action's SFX plays" checked={project.ducking} onChange={setDucking} />
        </div>
      </div>

    </div>
  );
}
