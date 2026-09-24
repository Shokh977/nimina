'use client';

import Link from 'next/link';

import { getTimeline } from '@/engine/render';
import { outputDimensions, qualityToResolution, resolutionToQuality, type ExportResolution } from '@/engine/export';
import { isPro, PLAN_LIMITS } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';
import { useVideoExport } from '../useVideoExport';

function slug(s: string): string {
  return (
    (s || 'app')
      .replace(/\*/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'app'
  );
}

const RESOLUTIONS: Array<[ExportResolution, string]> = [
  ['720p', 'HD (720p), smaller file'],
  ['1080p', 'Full HD (1080p)'],
  ['4k', '4K (2160p), largest file'],
];

const RESOLUTION_RANK: Record<ExportResolution, number> = { '720p': 0, '1080p': 1, '4k': 2 };

export default function ExportPanel() {
  const project = useEditorStore((s) => s.project);
  const plan = useEditorStore((s) => s.plan);
  const setQuality = useEditorStore((s) => s.setQuality);
  const { exporting, progress, status, result, start, cancel } = useVideoExport();

  const pro = isPro(plan);
  const maxResolution = PLAN_LIMITS[plan].maxExportResolution;
  const resolution = qualityToResolution(project.quality);
  const { width, height } = outputDimensions(project, resolution);
  const total = getTimeline(project).total;

  return (
    <div>
      <div className="mb-3.5 grid grid-cols-3 gap-2">
        <SummaryTile value={project.format} label="Format" />
        <SummaryTile value={`${width}×${height}`} label="Resolution" />
        <SummaryTile value={`${total.toFixed(1)}s`} label="Length" />
      </div>

      <label className="block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
        Quality
        <select
          value={resolution}
          onChange={(e) => setQuality(resolutionToQuality(e.target.value as ExportResolution))}
          disabled={exporting}
          className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
        >
          {RESOLUTIONS.map(([v, label]) => {
            const locked = RESOLUTION_RANK[v] > RESOLUTION_RANK[maxResolution];
            return (
              <option key={v} value={v} disabled={locked}>
                {label}
                {locked ? ' (Pro)' : ''}
              </option>
            );
          })}
        </select>
      </label>
      {!pro && (
        <p className="mt-1.5 text-[12.5px] text-neutral-500 dark:text-neutral-400">
          Free plan exports are capped at 720p and include a watermark.{' '}
          <Link href="/pricing" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
            Upgrade to Pro
          </Link>{' '}
          for up to 4K with no watermark.
        </p>
      )}

      <div className="mt-3.5 flex gap-2.5">
        <button
          onClick={() => start(resolution)}
          disabled={exporting || project.scenes.length === 0}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white disabled:opacity-50"
        >
          Export video
        </button>
        {exporting && (
          <button onClick={cancel} className="rounded-xl border border-black/10 px-4 py-2.5 font-bold dark:border-white/10">
            Cancel
          </button>
        )}
      </div>

      <div className="my-3.5 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <i style={{ width: `${progress}%` }} className="block h-full bg-indigo-600 transition-[width] duration-100 ease-linear" />
      </div>
      <p className="min-h-[1.5em] text-[13.5px] text-neutral-500 dark:text-neutral-400">{status}</p>

      {result && (
        <div className="mt-3.5">
          <video src={result.url} controls playsInline className="block max-h-[360px] w-full rounded-xl bg-black" />
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <a
              href={result.url}
              download={`${slug(project.appName)}-promo-${project.format.replace(':', 'x')}.${result.ext}`}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white"
            >
              Save video
            </a>
            <span className="text-[13.5px] text-neutral-500 dark:text-neutral-400">
              {result.ext.toUpperCase()}, {(result.sizeBytes / 1048576).toFixed(1)} MB, via {result.method === 'webcodecs' ? 'fast offline export' : 'real-time recording'}
            </span>
          </div>
        </div>
      )}

      <p className="mt-2.5 text-[12.5px] text-neutral-500 dark:text-neutral-400">
        Renders as fast as your device allows when WebCodecs export is available (most current Chrome, Edge and Safari versions); otherwise falls back to a real-time recording, during which this
        tab should stay open and in front.
      </p>
    </div>
  );
}

function SummaryTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-neutral-100 px-3 py-2.5 dark:bg-neutral-800/60">
      <b className="block text-[17px] font-extrabold">{value}</b>
      <span className="text-[12px] text-neutral-500 dark:text-neutral-400">{label}</span>
    </div>
  );
}
