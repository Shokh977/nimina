'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { analyzeStill, CUSTOM_SIZE_MAX, CUSTOM_SIZE_MIN, settledTime, slideStillDuration, STORE_PRESETS, stillTimeFor, type StillFileFormat, type StillIssue } from '@/engine/export';
import type { Slide } from '@/engine/types';
import { isPro, PLAN_LIMITS } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';
import RangeInput from '../ui/RangeInput';
import SectionLabel from '../ui/SectionLabel';
import SegmentedControl from '../ui/SegmentedControl';
import { planDimensions, useImageExport, type StillTarget } from '../useImageExport';
import StillPreview from './StillPreview';

const ROW =
  'flex w-full items-center gap-3 rounded-[11px] border px-3.5 py-2.5 text-left transition-colors duration-[.16s] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]';

function Check({ on }: { on: boolean }) {
  return (
    <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border ${on ? 'border-[#5b4bff] bg-[#5b4bff]' : 'border-white/[.22]'}`}>
      {on && <span className="text-[11px] leading-none text-white">✓</span>}
    </span>
  );
}

function slideLabel(s: Slide, i: number): string {
  if (s.kind === 'story') return `${i + 1} · Story`;
  const text = s.headline.replace(/\*/g, '').trim() || (s.kind === 'text' ? 'Text slide' : 'Screenshot');
  return `${i + 1} · ${text}`;
}

/** "Screenshot slides" = image slides with a screenshot assigned. */
const isScreenshotSlide = (s: Slide) => s.kind === 'image' && !!s.imgAssetId;

export default function ImageExportPanel() {
  const project = useEditorStore((s) => s.project);
  const images = useEditorStore((s) => s.assets.images);
  const plan = useEditorStore((s) => s.plan);
  const updateSlide = useEditorStore((s) => s.updateSlide);
  const { exporting, progress, files, zip, error, start, cancel } = useImageExport();

  const limits = PLAN_LIMITS[plan].imageExport;
  const pro = isPro(plan);
  const watermark = PLAN_LIMITS[plan].watermark;

  const visible = useMemo(() => project.scenes.map((s, i) => ({ s, i })).filter(({ s }) => !s.hidden), [project.scenes]);
  const [selectedSlides, setSelectedSlides] = useState<number[]>(() => visible.filter(({ s }) => isScreenshotSlide(s)).map(({ s }) => s.id));
  const [focusId, setFocusId] = useState<number | null>(() => visible.find(({ s }) => isScreenshotSlide(s))?.s.id ?? visible[0]?.s.id ?? null);
  const [presetKeys, setPresetKeys] = useState<string[]>(['iphone-6-9']);
  const [custom, setCustom] = useState({ on: false, width: 1290, height: 2796 });
  const [format, setFormat] = useState<StillFileFormat>('png');
  const [jpgQuality, setJpgQuality] = useState(92);

  const targets: StillTarget[] = [
    ...STORE_PRESETS.filter((p) => presetKeys.includes(p.id)).map((p) => ({ key: p.id, label: p.label, width: p.width, height: p.height })),
    ...(custom.on && limits.customSize ? [{ key: `custom-${custom.width}x${custom.height}`, label: 'Custom', width: custom.width, height: custom.height, custom: true }] : []),
  ];
  const exportSlides = visible.filter(({ s }) => selectedSlides.includes(s.id));
  const focus = visible.find(({ s }) => s.id === focusId) ?? null;

  // Selecting more sizes than the plan allows replaces the selection
  // instead (free = exactly one size, so the rows act like radio buttons).
  const togglePreset = (id: string) =>
    setPresetKeys((prev) => {
      if (prev.includes(id)) return prev.length + (custom.on ? 1 : 0) > 1 ? prev.filter((x) => x !== id) : prev;
      if (prev.length + (custom.on ? 1 : 0) >= limits.maxPresets) {
        setCustom((c) => ({ ...c, on: false }));
        return [id];
      }
      return [...prev, id];
    });
  const toggleSlide = (id: number) => setSelectedSlides((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const clampSize = (v: number) => Math.round(Math.min(CUSTOM_SIZE_MAX, Math.max(CUSTOM_SIZE_MIN, v || CUSTOM_SIZE_MIN)));

  // Crop/overlap checks for every slide x size about to be exported.
  const issues = useMemo(() => {
    const out: Array<{ slideId: number; slideIndex: number; target: StillTarget; issue: StillIssue }> = [];
    for (const { s, i } of exportSlides)
      for (const t of targets) for (const issue of analyzeStill(project, s, t.width, t.height)) out.push({ slideId: s.id, slideIndex: i, target: t, issue });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, selectedSlides, presetKeys, custom.on, custom.width, custom.height]);

  const focusTime = focus ? stillTimeFor(project, focus.s) : 0;
  const focusDur = focus ? slideStillDuration(focus.s) : 0;
  const focusAuto = focus ? focus.s.stillTime == null : true;

  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <SectionLabel trailing={<span className="text-[11.5px] text-[#767e8d]">{exportSlides.length} selected</span>}>Slides</SectionLabel>
        <div className="grid gap-1.5">
          {visible.map(({ s, i }) => {
            const on = selectedSlides.includes(s.id);
            const focused = s.id === focusId;
            return (
              <div key={s.id} className={`${ROW} ${focused ? 'border-[#8b7dff]/60 bg-[#5b4bff]/[.12]' : 'border-white/10 bg-white/[.03] hover:bg-white/[.06]'}`}>
                <button type="button" aria-label={on ? 'Exclude slide' : 'Include slide'} onClick={() => toggleSlide(s.id)} disabled={exporting} className="shrink-0">
                  <Check on={on} />
                </button>
                <button type="button" onClick={() => setFocusId(s.id)} className="block min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[#f4f5f8]">
                  {slideLabel(s, i)}
                </button>
                <span className="shrink-0 font-[family-name:var(--font-space-grotesk)] text-[11.5px] text-[#767e8d]">
                  {stillTimeFor(project, s).toFixed(1)}s{s.stillTime == null ? '' : ' •'}
                </span>
              </div>
            );
          })}
          {visible.length === 0 && <p className="text-[12.5px] text-[#767e8d]">Add a slide to export images.</p>}
        </div>
      </div>

      {focus && (
        <div className="rounded-xl border border-white/[.08] bg-white/[.02] p-3.5">
          <RangeInput
            label={`Frame for slide ${focus.i + 1}`}
            valueLabel={`${focusTime.toFixed(2)}s${focusAuto ? ' · settled' : ''}`}
            min={0}
            max={Math.max(0.05, focusDur)}
            step={0.05}
            value={focusTime}
            onChange={(v) => updateSlide(focus.s.id, { stillTime: v })}
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11.5px] text-[#767e8d]">Settled at {settledTime(project, focus.s).toFixed(2)}s</span>
            {!focusAuto && (
              <button type="button" onClick={() => updateSlide(focus.s.id, { stillTime: null })} className="text-[12px] font-semibold text-[#8b7dff] hover:text-[#a89bff]">
                Reset to settled
              </button>
            )}
          </div>
          {targets.length > 0 && (
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {targets.map((t) => {
                const flagged = issues.some((x) => x.slideId === focus.s.id && x.target.key === t.key);
                return (
                  <div key={t.key} className="grid gap-1">
                    <div className={`rounded-[8px] p-[2px] ${flagged ? 'bg-[#ff8f76]' : ''}`}>
                      <StillPreview project={project} images={images} slideId={focus.s.id} t={focusTime} width={t.width} height={t.height} watermark={watermark} displayWidth={t.width > t.height ? 150 : 92} />
                    </div>
                    <span className={`text-[11px] ${flagged ? 'text-[#ff8f76]' : 'text-[#9aa1af]'}`}>{t.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div>
        <SectionLabel trailing={!pro && <span className="text-[11.5px] text-[#767e8d]">Free: one size</span>}>Store sizes</SectionLabel>
        <div className="grid gap-1.5">
          {STORE_PRESETS.map((p) => {
            const on = presetKeys.includes(p.id);
            const { width, height } = planDimensions({ key: p.id, label: p.label, width: p.width, height: p.height }, limits.scale);
            return (
              <button key={p.id} type="button" onClick={() => togglePreset(p.id)} disabled={exporting} className={`${ROW} border-white/10 bg-white/[.03] hover:bg-white/[.06]`}>
                <Check on={on} />
                <span className="min-w-0 flex-1 text-[13px] font-semibold text-[#f4f5f8]">
                  {p.label} <span className="font-normal text-[#767e8d]">{width}×{height}</span>
                </span>
                <span className="shrink-0 text-[11.5px] text-[#767e8d]">{p.store}</span>
              </button>
            );
          })}
          <div className={`${ROW} border-white/10 bg-white/[.03] ${limits.customSize ? '' : 'opacity-60'}`}>
            <button
              type="button"
              disabled={exporting || !limits.customSize}
              onClick={() => setCustom((c) => ({ ...c, on: !c.on || presetKeys.length === 0 }))}
              aria-label="Custom size"
              className="shrink-0"
            >
              <Check on={custom.on && limits.customSize} />
            </button>
            <span className="text-[13px] font-semibold text-[#f4f5f8]">Custom{!limits.customSize && ' 🔒'}</span>
            <span className="ml-auto flex items-center gap-1.5 text-[12px] text-[#767e8d]">
              {(['width', 'height'] as const).map((k, idx) => (
                <span key={k} className="flex items-center gap-1.5">
                  {idx === 1 && '×'}
                  <input
                    type="number"
                    aria-label={`Custom ${k}`}
                    min={CUSTOM_SIZE_MIN}
                    max={CUSTOM_SIZE_MAX}
                    disabled={exporting || !limits.customSize}
                    defaultValue={custom[k]}
                    onBlur={(e) => {
                      const v = clampSize(Number(e.target.value));
                      e.target.value = String(v);
                      setCustom((c) => ({ ...c, [k]: v }));
                    }}
                    className="w-[64px] rounded-[7px] border border-white/[.12] bg-black/20 px-2 py-1 text-[12.5px] text-[#f4f5f8]"
                  />
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>

      <div>
        <SectionLabel>File type</SectionLabel>
        <SegmentedControl
          options={[
            ['png', 'PNG'],
            ['jpg', 'JPG'],
          ]}
          value={format}
          onChange={setFormat}
        />
        {format === 'jpg' && (
          <div className="mt-3">
            <RangeInput label="JPG quality" valueLabel={jpgQuality} min={50} max={100} step={1} value={jpgQuality} onChange={setJpgQuality} />
          </div>
        )}
        <p className="mt-2 text-[12px] text-[#767e8d]">Saved without transparency, which both stores require.</p>
      </div>

      {issues.length > 0 && (
        <div className="rounded-xl border border-[#ff8f76]/30 bg-[#ff8f76]/[.06] px-3.5 py-3">
          <p className="text-[12.5px] font-semibold text-[#ffb3a3]">Check these before exporting</p>
          <ul className="mt-1.5 grid gap-1">
            {issues.map((x, n) => (
              <li key={n}>
                <button type="button" onClick={() => setFocusId(x.slideId)} className="text-left text-[12px] text-[#f0c9c0] hover:underline">
                  Slide {x.slideIndex + 1}, {x.target.label}: {x.issue.message}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-[#8b7dff]/[.28] px-4 py-3.5" style={{ background: 'radial-gradient(120% 200% at 0% 0%, rgba(91,75,255,.22), #0d0f15 62%)' }}>
        {!pro && <p className="mb-3 text-[12.5px] text-[#cfc8ff]">Free plan exports one size at half resolution, with a watermark.</p>}
        <div className="flex gap-2.5">
          <button
            onClick={() => start(exportSlides.map(({ s }) => s.id), targets, format, jpgQuality / 100)}
            disabled={exporting || exportSlides.length === 0 || targets.length === 0}
            className="flex-1 rounded-xl bg-[#5b4bff] px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_10px_26px_rgba(91,75,255,.38)] transition-colors duration-[.16s] hover:bg-[#6d5eff] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
          >
            {exporting ? `Rendering ${progress.done + 1} of ${progress.total}…` : `Export ${exportSlides.length * targets.length} image${exportSlides.length * targets.length === 1 ? '' : 's'}`}
          </button>
          {exporting && (
            <button onClick={cancel} className="rounded-xl border border-white/[.16] px-4 py-2.5 text-[14px] font-semibold text-[#f4f5f8] hover:bg-white/[.08]">
              Cancel
            </button>
          )}
        </div>
        {exporting && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%`, background: 'linear-gradient(90deg,#5b4bff,#ff7a59)' }} />
          </div>
        )}
        {!pro && (
          <p className="mt-2.5 text-[12px] text-[#9aa1af]">
            <Link href="/pricing" className="font-semibold text-[#8b7dff] hover:text-[#a89bff]">
              Upgrade to Pro
            </Link>{' '}
            for every store size at full resolution, no watermark.
          </p>
        )}
      </div>

      {error && <p className="text-[12.5px] text-[#ff8f76]">{error}</p>}

      {(zip || files.length > 0) && (
        <div className="rounded-xl border border-white/[.08] bg-white/[.03] p-3.5">
          {zip && (
            <div className="mb-3 flex flex-wrap items-center gap-2.5">
              <a href={zip.url} download={zip.name} className="rounded-[10px] bg-[#5b4bff] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors duration-[.16s] hover:bg-[#6d5eff]">
                Download ZIP
              </a>
              <span className="text-[12px] text-[#767e8d]">
                {files.length} images, {(zip.sizeBytes / 1048576).toFixed(1)} MB
              </span>
            </div>
          )}
          <ul className="grid gap-1">
            {files.map((f) => (
              <li key={f.name} className="flex items-center justify-between gap-2 text-[12px]">
                <a href={f.url} download={f.name} className="min-w-0 truncate font-semibold text-[#cfc8ff] hover:underline">
                  {f.name}
                </a>
                <span className="shrink-0 text-[#767e8d]">
                  {f.width}×{f.height}, {(f.sizeBytes / 1048576).toFixed(1)} MB
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
