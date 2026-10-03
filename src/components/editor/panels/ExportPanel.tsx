'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';

import { outputDimensions, qualityToResolution, resolutionToQuality, type ExportResolution } from '@/engine/export';
import { getTimeline } from '@/engine/render';
import { FORMATS } from '@/engine/constants';
import type { Format } from '@/engine/types';
import { deviceExportCap, PHONE_EXPORT_NOTE } from '@/lib/device';
import { isPro, PLAN_LIMITS } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';
import SectionLabel from '../ui/SectionLabel';
import SegmentedControl from '../ui/SegmentedControl';
import { useVideoExport } from '../useVideoExport';
import ImageExportPanel from './ImageExportPanel';

// Only multilingual projects show this tab; others never load it.
const BatchExportPanel = dynamic(() => import('./BatchExportPanel'));

function slug(s: string): string {
  return (
    (s || 'app')
      .replace(/\*/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'app'
  );
}

const FORMAT_KEYS = Object.keys(FORMATS) as Format[];
const QUALITY_OPTIONS: Array<[ExportResolution, string]> = [
  ['720p', '720p'],
  ['1080p', '1080p'],
  ['4k', '4K'],
];
const RESOLUTION_RANK: Record<ExportResolution, number> = { '720p': 0, '1080p': 1, '4k': 2 };

export default function ExportPanel() {
  const [kind, setKind] = useState<'video' | 'images' | 'batch'>('video');
  const multilingual = (useEditorStore((s) => s.project.localization?.languages.length) ?? 0) > 1;
  return (
    <div className="grid grid-cols-1 gap-5">
      <SegmentedControl
        options={[
          ['video', 'Video'],
          ['images', 'Images'],
          ...(multilingual ? ([['batch', 'All languages']] as Array<['batch', string]>) : []),
        ]}
        value={kind}
        onChange={setKind}
      />
      {/* Both stay mounted so switching tabs mid-render doesn't drop a running export's progress/results. */}
      <div hidden={kind !== 'video'}>
        <VideoExportPanel />
      </div>
      <div hidden={kind !== 'images'}>
        <ImageExportPanel />
      </div>
      {multilingual && (
        <div hidden={kind !== 'batch'}>
          <BatchExportPanel />
        </div>
      )}
    </div>
  );
}

function VideoExportPanel() {
  const project = useEditorStore((s) => s.project);
  const plan = useEditorStore((s) => s.plan);
  const setQuality = useEditorStore((s) => s.setQuality);
  const { exporting, results, start, cancel } = useVideoExport();
  const [selectedFormats, setSelectedFormats] = useState<Format[]>([project.format]);

  const pro = isPro(plan);
  const planMax = PLAN_LIMITS[plan].maxExportResolution;
  const maxResolution = deviceExportCap(planMax);
  const phoneCapped = maxResolution !== planMax;
  // What will actually render — a 4K setting chosen on a computer shows (and
  // renders) as 720p on a phone.
  const chosen = qualityToResolution(project.quality);
  const resolution = RESOLUTION_RANK[chosen] > RESOLUTION_RANK[maxResolution] ? maxResolution : chosen;
  const total = getTimeline(project).total;

  const toggleFormat = (f: Format) => {
    setSelectedFormats((prev) => (prev.includes(f) ? (prev.length > 1 ? prev.filter((x) => x !== f) : prev) : [...prev, f]));
  };

  return (
    <div className="grid grid-cols-1 gap-5">
      <div>
        <SectionLabel>Sizes to render</SectionLabel>
        <div className="grid gap-1.5">
          {FORMAT_KEYS.map((f) => {
            const { width, height } = outputDimensions({ ...project, format: f }, resolution);
            const checked = selectedFormats.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFormat(f)}
                disabled={exporting}
                className="flex w-full items-center gap-3 rounded-[11px] border border-white/10 bg-white/[.03] px-3.5 py-3 text-left transition-colors duration-[.16s] hover:bg-white/[.06] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
              >
                <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border ${checked ? 'border-[#5b4bff] bg-[#5b4bff]' : 'border-white/[.22]'}`}>{checked && <span className="text-[11px] leading-none text-white">✓</span>}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-[#f4f5f8]">
                    {f} · {FORMATS[f].name} <span className="font-normal text-[#767e8d]">{width}×{height}</span>
                  </span>
                </span>
                <span className="shrink-0 text-[11.5px] text-[#767e8d]">{FORMATS[f].use}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionLabel>Quality</SectionLabel>
        <SegmentedControl
          options={QUALITY_OPTIONS.map(([v, label]) => [v, RESOLUTION_RANK[v] > RESOLUTION_RANK[maxResolution] ? `${label} 🔒` : label] as [ExportResolution, string])}
          value={resolution}
          onChange={(v) => {
            if (RESOLUTION_RANK[v] > RESOLUTION_RANK[maxResolution]) return;
            setQuality(resolutionToQuality(v));
          }}
        />
        {phoneCapped && <p className="mt-2 text-[12px] leading-snug text-[#ffd166]">{PHONE_EXPORT_NOTE}</p>}
        <p className="mt-2 text-[12px] text-[#767e8d]">{total.toFixed(1)}s total</p>
      </div>

      <div className="rounded-xl border border-[#8b7dff]/[.28] px-4 py-3.5" style={{ background: 'radial-gradient(120% 200% at 0% 0%, rgba(91,75,255,.22), #0d0f15 62%)' }}>
        {!pro && <p className="mb-3 text-[12.5px] text-[#cfc8ff]">Free plan renders 720p with a watermark.</p>}
        <div className="flex gap-2.5">
          <button
            onClick={() => start(selectedFormats, resolution)}
            disabled={exporting || project.scenes.length === 0}
            className="flex-1 rounded-xl bg-[#5b4bff] px-4 py-2.5 text-[14px] font-semibold text-white shadow-[0_10px_26px_rgba(91,75,255,.38)] transition-colors duration-[.16s] hover:bg-[#6d5eff] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
          >
            {exporting ? 'Rendering…' : `Render video${selectedFormats.length > 1 ? ` (${selectedFormats.length})` : ''}`}
          </button>
          {exporting && (
            <button onClick={cancel} className="rounded-xl border border-white/[.16] px-4 py-2.5 text-[14px] font-semibold text-[#f4f5f8] hover:bg-white/[.08]">
              Cancel
            </button>
          )}
        </div>
        {!pro && (
          <p className="mt-2.5 text-[12px] text-[#9aa1af]">
            <Link href="/pricing" className="font-semibold text-[#8b7dff] hover:text-[#a89bff]">
              Upgrade to Pro
            </Link>{' '}
            for up to 4K with no watermark.
          </p>
        )}
      </div>

      {results.length > 0 && (
        <div className="grid gap-3">
          {results.map((r) => (
            <div key={r.format} className="rounded-xl border border-white/[.08] bg-white/[.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-semibold text-[#f4f5f8]">Rendering {r.format}</span>
                <span className="font-[family-name:var(--font-space-grotesk)] text-[12.5px] text-[#cfc8ff]">{r.status === 'error' ? 'Failed' : r.status === 'queued' ? 'Queued' : `${Math.round(r.progress)}%`}</span>
              </div>
              {r.status !== 'done' && r.status !== 'error' && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full transition-[width] duration-100 ease-linear" style={{ width: `${r.progress}%`, background: 'linear-gradient(90deg,#5b4bff,#ff7a59)' }} />
                </div>
              )}
              {r.status === 'error' && <p className="mt-1.5 text-[12px] text-[#ff8f76]">{r.error}</p>}
              {r.status === 'done' && r.outcome && (
                <div className="mt-2.5">
                  <video src={r.outcome.url} controls playsInline className="block max-h-[240px] w-full rounded-lg bg-black" />
                  <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                    <a
                      href={r.outcome.url}
                      download={`${slug(project.appName)}${r.locale ? `-${r.locale}` : ''}-promo-${r.format.replace(':', 'x')}.${r.outcome.ext}`}
                      className="rounded-[10px] bg-[#5b4bff] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors duration-[.16s] hover:bg-[#6d5eff]"
                    >
                      Save video
                    </a>
                    <span className="text-[12px] text-[#767e8d]">
                      {r.outcome.ext.toUpperCase()}, {(r.outcome.sizeBytes / 1048576).toFixed(1)} MB, {r.outcome.method === 'webcodecs' ? 'fast offline export' : 'real-time recording'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[12px] text-[#767e8d]">
        Renders as fast as your device allows when WebCodecs export is available (most current Chrome, Edge and Safari versions); otherwise falls back to a real-time recording, during which this
        tab should stay open and in front.
      </p>
    </div>
  );
}
