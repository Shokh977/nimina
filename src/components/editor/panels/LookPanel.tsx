'use client';

import Link from 'next/link';

import { BG_PATTERNS, FCOLORS, FONTS, HL_STYLES, MODELS, PRESETS } from '@/engine/constants';
import { isModelAllowed, isPro } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';
import SegButtons from '../ui/SegButtons';

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
  const setFont = useEditorStore((s) => s.setFont);

  return (
    <div>
      <p className="mb-4 rounded-xl bg-indigo-50 px-3 py-2.5 text-[13px] dark:bg-indigo-500/10">These are the defaults for every slide. Any slide can override them in its Style section.</p>

      <SectionTitle first>Device</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(MODELS).map(([k, m]) => {
          const allowed = isModelAllowed(plan, k as typeof project.model);
          return (
            <button
              key={k}
              aria-pressed={project.model === k}
              disabled={!allowed}
              onClick={() => setModel(k as typeof project.model)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-black/10 bg-white px-1.5 py-2.5 text-[12.5px] font-semibold aria-pressed:border-indigo-500 aria-pressed:ring-2 aria-pressed:ring-indigo-200 disabled:opacity-40 dark:border-white/10 dark:bg-neutral-800 dark:aria-pressed:ring-indigo-500/30"
            >
              {m.label}
              {!allowed && <span className="block text-[10.5px] font-bold text-indigo-500">Pro</span>}
            </button>
          );
        })}
      </div>
      {!isPro(plan) && (
        <p className="mt-2 text-[12.5px] text-neutral-500 dark:text-neutral-400">
          Tablet and browser frames are{' '}
          <Link href="/pricing" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
            Pro features
          </Link>
          .
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2.5">
        {FCOLORS.map((f) => {
          const swatch = f.id === 'theme' ? project.colors.accent : f.body;
          return (
            <button key={f.id} aria-pressed={project.fcolor === f.id} onClick={() => setFcolor(f.id)} className="flex flex-col items-center gap-1 text-[11.5px] font-semibold text-neutral-500">
              <i style={{ background: swatch }} className="block h-[30px] w-[30px] rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.15)] aria-pressed:shadow-[0_0_0_2px_var(--tw-color-indigo-600)]" />
              {f.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12.5px] text-neutral-500 dark:text-neutral-400">Browser works best with desktop screenshots; tablet with tablet screenshots.</p>

      <SectionTitle>Color theme</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p, i) => (
          <button key={p.name} aria-pressed={project.preset === i} onClick={() => setPreset(i)} className="overflow-hidden rounded-2xl border-2 border-transparent text-left aria-pressed:border-indigo-500">
            <div style={{ background: `linear-gradient(150deg, ${p.a}, ${p.b})` }} className="flex h-[50px] items-end p-1.5">
              <i style={{ background: p.accent }} className="block h-[14px] w-[14px] rounded-full" />
            </div>
            <span className="block bg-white px-2 py-1.5 text-[12.5px] font-bold dark:bg-neutral-800">{p.name}</span>
          </button>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-2">
        <ColorInput label="Top" value={project.colors.a} onChange={(v) => setColors({ a: v })} />
        <ColorInput label="Bottom" value={project.colors.b} onChange={(v) => setColors({ b: v })} />
        <ColorInput label="Text" value={project.colors.text} onChange={(v) => setColors({ text: v })} />
        <ColorInput label="Accent" value={project.colors.accent} onChange={(v) => setColors({ accent: v })} />
      </div>

      <SectionTitle>Background pattern</SectionTitle>
      <SegButtons options={BG_PATTERNS} value={project.bgPattern} onChange={setBgPattern} />

      <SectionTitle>Typeface</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {FONTS.map((f, i) => (
          <button
            key={f.name}
            aria-pressed={font === i}
            onClick={() => setFont(i)}
            className="rounded-xl border border-black/10 bg-white px-2 py-2.5 text-left leading-tight aria-pressed:border-indigo-500 aria-pressed:ring-2 aria-pressed:ring-indigo-200 dark:border-white/10 dark:bg-neutral-800"
          >
            <b style={{ fontFamily: `'${f.name}', Figtree, sans-serif`, fontWeight: f.h }} className="block text-[22px]">
              Aa
            </b>
            <span className="text-[12px] text-neutral-500 dark:text-neutral-400">{f.label}</span>
          </button>
        ))}
      </div>

      <SectionTitle>Highlighted words</SectionTitle>
      <SegButtons options={HL_STYLES} value={project.hlStyle} onChange={setHlStyle} />

      <SectionTitle>Text position</SectionTitle>
      <SegButtons
        options={[
          ['top', 'Top'],
          ['bottom', 'Bottom'],
        ]}
        value={project.textPos}
        onChange={setTextPos}
      />
      <p className="mt-2 text-[12.5px] text-neutral-500 dark:text-neutral-400">In 16:9, top puts text on the left and bottom puts it on the right.</p>

      <SectionTitle>Extras</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        <Check label="Floating shapes" checked={project.shapes} onChange={setShapes} />
        <Check label="Story progress bars" checked={project.storyBars} onChange={setStoryBars} />
        <Check label="Film grain" checked={project.grain} onChange={setGrain} />
        <Check label="Vignette" checked={project.vignette} onChange={setVignette} />
      </div>
    </div>
  );
}

function SectionTitle({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return <div className={`text-[13px] font-bold ${first ? 'mt-0' : 'mt-5'} mb-2`}>{children}</div>;
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="text-center text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
      {label}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 block h-9 w-full rounded-lg border border-black/10 bg-white p-0.5 dark:border-white/10 dark:bg-neutral-800" />
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-[13.5px] font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-[18px] w-[18px] accent-indigo-600" />
      {label}
    </label>
  );
}
