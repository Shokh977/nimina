'use client';

import { useState } from 'react';

import { qualityToResolution, STORE_PRESETS } from '@/engine/export';
import { FORMATS } from '@/engine/constants';
import { localeDef } from '@/engine/locales';
import type { Format } from '@/engine/types';
import { PLAN_LIMITS } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';
import SectionLabel from '../ui/SectionLabel';
import { useBatchExport } from '../useBatchExport';

const FORMAT_KEYS = Object.keys(FORMATS) as Format[];

function Check({ on }: { on: boolean }) {
  return (
    <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border ${on ? 'border-[#5b4bff] bg-[#5b4bff]' : 'border-white/[.22]'}`}>
      {on && <span className="text-[11px] leading-none text-white">✓</span>}
    </span>
  );
}

const ROW = 'flex w-full items-center gap-3 rounded-[11px] border border-white/10 bg-white/[.03] px-3.5 py-2.5 text-left text-[13px] font-semibold text-[#f4f5f8] hover:bg-white/[.06] disabled:opacity-50';

/** "All languages": videos and/or store image sets for every selected
 * language in one run, delivered as one ZIP with a folder per locale. */
export default function BatchExportPanel() {
  const project = useEditorStore((s) => s.project);
  const plan = useEditorStore((s) => s.plan);
  const { running, rows, zip, start, cancel } = useBatchExport();
  const languages = project.localization?.languages ?? [];
  const [locales, setLocales] = useState<string[]>(() => languages.map((l) => l.locale));
  const [formats, setFormats] = useState<Format[]>([project.format]);
  const [presets, setPresets] = useState<string[]>(['iphone-6-9']);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const maxPresets = PLAN_LIMITS[plan].imageExport.maxPresets;

  if (languages.length < 2) {
    return <p className="text-[12.5px] text-[#767e8d]">Add a second language in the Languages tab to export every language at once.</p>;
  }

  const slideIds = project.scenes.filter((s) => s.kind === 'image' && !!s.imgAssetId && !s.hidden).map((s) => s.id);
  const targets = STORE_PRESETS.filter((p) => presets.includes(p.id)).map((p) => ({ key: p.id, label: p.label, width: p.width, height: p.height }));
  const fileCount = locales.length * (formats.length + targets.length * slideIds.length);

  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <SectionLabel>Languages</SectionLabel>
        <div className="grid gap-1.5">
          {languages.map((l) => (
            <button key={l.locale} type="button" disabled={running} onClick={() => setLocales((v) => toggle(v, l.locale))} className={ROW}>
              <Check on={locales.includes(l.locale)} />
              {localeDef(l.locale).label} <span className="font-normal text-[#767e8d]">{localeDef(l.locale).native}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>Videos ({qualityToResolution(project.quality)})</SectionLabel>
        <div className="grid gap-1.5">
          {FORMAT_KEYS.map((f) => (
            <button key={f} type="button" disabled={running} onClick={() => setFormats((v) => toggle(v, f))} className={ROW}>
              <Check on={formats.includes(f)} />
              {f} · {FORMATS[f].name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel trailing={<span className="text-[11.5px] text-[#767e8d]">{slideIds.length} screenshot slides</span>}>Store images (PNG)</SectionLabel>
        <div className="grid gap-1.5">
          {STORE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={running}
              onClick={() => setPresets((v) => (v.includes(p.id) ? v.filter((x) => x !== p.id) : v.length >= maxPresets ? [p.id] : [...v, p.id]))}
              className={ROW}
            >
              <Check on={presets.includes(p.id)} />
              {p.label} <span className="font-normal text-[#767e8d]">{p.width}×{p.height}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => start({ locales, videoFormats: formats, resolution: qualityToResolution(project.quality), imageTargets: targets, slideIds })}
          disabled={running || fileCount === 0}
          className="flex-1 rounded-xl bg-[#5b4bff] px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_10px_26px_rgba(91,75,255,.38)] hover:bg-[#6d5eff] disabled:opacity-50"
        >
          {running ? 'Exporting…' : `Export ${locales.length} language${locales.length === 1 ? '' : 's'} (${fileCount} files)`}
        </button>
        {running && (
          <button type="button" onClick={cancel} className="rounded-xl border border-white/[.16] px-4 py-2.5 text-[14px] font-semibold text-[#f4f5f8] hover:bg-white/[.08]">
            Cancel
          </button>
        )}
      </div>

      {rows.length > 0 && (
        <div className="grid gap-2" data-testid="batch-progress">
          {rows.map((r) => (
            <div key={r.locale} className="rounded-xl border border-white/[.08] bg-white/[.03] p-3">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="font-semibold text-[#f4f5f8]">{localeDef(r.locale).label}</span>
                <span className={r.status === 'error' ? 'text-[#ff8f76]' : 'text-[#cfc8ff]'}>
                  {r.status === 'rendering' ? `${r.step} · ${Math.round(r.progress)}%` : r.status === 'queued' ? 'Queued' : r.status === 'done' ? `Done · ${r.files} files` : r.status === 'canceled' ? 'Canceled' : `Failed: ${r.error}`}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full" style={{ width: `${r.progress}%`, background: 'linear-gradient(90deg,#5b4bff,#ff7a59)' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {zip && (
        <div className="flex flex-wrap items-center gap-2.5">
          <a href={zip.url} download={zip.name} className="rounded-[10px] bg-[#5b4bff] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#6d5eff]">
            Download ZIP
          </a>
          <span className="text-[12px] text-[#767e8d]">{(zip.sizeBytes / 1048576).toFixed(1)} MB</span>
        </div>
      )}
    </div>
  );
}
