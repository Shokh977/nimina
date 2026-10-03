'use client';

import CustomFonts from './CustomFonts';
import Link from 'next/link';

import { BG_PATTERNS, FCOLORS, FONTS, HL_STYLES, MODELS, PRESETS } from '@/engine/constants';
import type { TextPos } from '@/engine/types';
import { isModelAllowed, isPro } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';
import Details from '../ui/Details';
import SectionLabel from '../ui/SectionLabel';
import SegButtons from '../ui/SegButtons';
import SegmentedControl from '../ui/SegmentedControl';
import SelectableRow from '../ui/SelectableRow';
import SwatchGrid from '../ui/SwatchGrid';
import ToggleRow from '../ui/ToggleRow';

const FRAME_SWATCHES = FCOLORS.map((f) => ({ id: f.id, background: f.body ?? 'var(--accent-swatch)', label: f.label }));
// 5 curated accent shortcuts (spec: "Accent as five 38px circular swatches")
// — a subset of PRESETS' own accent colors, not a new palette. The full
// custom Top/Bottom/Text/Accent color pickers still exist, just moved to
// an Advanced section below so no color-picking capability is lost.
const ACCENT_PRESET_INDEXES = [0, 1, 2, 5, 8].filter((i) => i < PRESETS.length);
const TEXT_POS_OPTIONS: Array<[TextPos, string]> = [
  ['top', 'Top'],
  ['center', 'Center'],
  ['bottom', 'Bottom'],
];

export default function LookPanel() {
  const project = useEditorStore((s) => s.project);
  const plan = useEditorStore((s) => s.plan);
  const setModel = useEditorStore((s) => s.setModel);
  const setFcolor = useEditorStore((s) => s.setFcolor);
  const setPreset = useEditorStore((s) => s.setPreset);
  const setColors = useEditorStore((s) => s.setColors);
  const setBgPattern = useEditorStore((s) => s.setBgPattern);
  const setHlStyle = useEditorStore((s) => s.setHlStyle);
  const setTextPos = useEditorStore((s) => s.setTextPos);
  const setShapes = useEditorStore((s) => s.setShapes);
  const setStoryBars = useEditorStore((s) => s.setStoryBars);
  const setGrain = useEditorStore((s) => s.setGrain);
  const setVignette = useEditorStore((s) => s.setVignette);
  const font = useEditorStore((s) => s.project.font);
  const customFont = useEditorStore((s) => s.project.customFont);
  const setFont = useEditorStore((s) => s.setFont);

  const accentSwatches = ACCENT_PRESET_INDEXES.map((i) => ({ id: PRESETS[i].accent, background: PRESETS[i].accent, label: PRESETS[i].name }));

  return (
    <div className="grid grid-cols-1 gap-5">
      <p className="rounded-xl border border-[#8b7dff]/[.28] bg-[#5b4bff]/[.1] px-3.5 py-3 text-[12.5px] text-[#cfc8ff]">Applies to the whole video. Any slide can override it.</p>

      <div>
        <SectionLabel>Device</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(MODELS).map(([k, m]) => {
            const allowed = isModelAllowed(plan, k as typeof project.model);
            return (
              <button
                key={k}
                aria-pressed={project.model === k}
                disabled={!allowed}
                onClick={() => setModel(k as typeof project.model)}
                className="flex flex-col items-center gap-1.5 rounded-[11px] border px-1.5 py-2.5 text-[12px] font-semibold text-[#c9cdd8] transition-colors duration-[.16s] disabled:opacity-40 aria-pressed:border-[#8b7dff]/55 aria-pressed:bg-[#5b4bff]/[.14] aria-pressed:text-[#cfc8ff] border-white/10 bg-white/[.03] hover:bg-white/[.06]"
              >
                {m.label}
                {!allowed && <span className="block text-[10px] font-bold text-[#8b7dff]">Pro</span>}
              </button>
            );
          })}
        </div>
        {!isPro(plan) && (
          <p className="mt-2 text-[12px] text-[#767e8d]">
            Tablet and browser frames are{' '}
            <Link href="/pricing" className="font-semibold text-[#8b7dff] hover:text-[#a89bff]">
              Pro features
            </Link>
            .
          </p>
        )}
      </div>

      <div>
        <SectionLabel>Frame color</SectionLabel>
        <div style={{ ['--accent-swatch' as string]: project.colors.accent }}>
          <SwatchGrid items={FRAME_SWATCHES} value={project.fcolor} onChange={(id) => setFcolor(id as typeof project.fcolor)} size={30} />
        </div>
        <p className="mt-2 text-[12px] text-[#767e8d]">Browser works best with desktop screenshots; tablet with tablet screenshots.</p>
      </div>

      <div>
        <SectionLabel>Accent</SectionLabel>
        <SwatchGrid items={accentSwatches} value={project.colors.accent} onChange={(v) => setColors({ accent: v })} size={38} />
      </div>

      <div>
        <SectionLabel>Color theme</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p, i) => (
            <button key={p.name} aria-pressed={project.preset === i} onClick={() => setPreset(i)} className="overflow-hidden rounded-[12px] border-2 border-transparent text-left transition-colors duration-[.16s] aria-pressed:border-[#8b7dff]">
              <div style={{ background: `linear-gradient(150deg, ${p.a}, ${p.b})` }} className="flex h-[42px] items-end p-1.5">
                <i style={{ background: p.accent }} className="block h-[12px] w-[12px] rounded-full" />
              </div>
              <span className="block bg-[#11131a] px-2 py-1.5 text-[11.5px] font-semibold text-[#f4f5f8]">{p.name}</span>
            </button>
          ))}
        </div>
        <Details summary="Advanced: custom colors">
          <div className="grid grid-cols-4 gap-2">
            <ColorInput label="Top" value={project.colors.a} onChange={(v) => setColors({ a: v })} />
            <ColorInput label="Bottom" value={project.colors.b} onChange={(v) => setColors({ b: v })} />
            <ColorInput label="Text" value={project.colors.text} onChange={(v) => setColors({ text: v })} />
            <ColorInput label="Accent" value={project.colors.accent} onChange={(v) => setColors({ accent: v })} />
          </div>
        </Details>
      </div>

      <div>
        <SectionLabel>Background pattern</SectionLabel>
        <SegButtons options={BG_PATTERNS} value={project.bgPattern} onChange={setBgPattern} />
      </div>

      <div>
        <SectionLabel>Typeface</SectionLabel>
        <div className="grid gap-1.5">
          {FONTS.map((f, i) => (
            <SelectableRow
              key={f.name}
              selected={!customFont && font === i}
              onClick={() => setFont(i)}
              title={
                <span style={{ fontFamily: `'${f.name}', Figtree, sans-serif`, fontWeight: f.h }} className="text-[14.5px]">
                  {f.name}
                </span>
              }
              trailing={<span className="text-[11.5px] text-[#767e8d]">{f.label}</span>}
            />
          ))}
        </div>
        <CustomFonts selectedId={customFont} />
      </div>

      <div>
        <SectionLabel>Highlighted words</SectionLabel>
        <SegButtons options={HL_STYLES} value={project.hlStyle} onChange={setHlStyle} />
      </div>

      <div>
        <SectionLabel>Text position</SectionLabel>
        <SegmentedControl options={TEXT_POS_OPTIONS} value={project.textPos} onChange={setTextPos} />
        <p className="mt-2 text-[12px] text-[#767e8d]">In 16:9, top and bottom put the text on the left or right instead.</p>
      </div>

      <div>
        <SectionLabel>Extras</SectionLabel>
        <div className="grid gap-2">
          <ToggleRow title="Floating shapes" checked={project.shapes} onChange={setShapes} />
          <ToggleRow title="Story progress bars" checked={project.storyBars} onChange={setStoryBars} />
          <ToggleRow title="Film grain" checked={project.grain} onChange={setGrain} />
          <ToggleRow title="Vignette" checked={project.vignette} onChange={setVignette} />
        </div>
      </div>
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-center text-[11.5px] font-semibold text-[#767e8d]">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block h-9 w-full rounded-[10px] border border-white/[.12] bg-white/[.03] p-0.5" />
    </label>
  );
}
