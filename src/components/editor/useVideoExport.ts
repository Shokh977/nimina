'use client';

import { useCallback, useRef, useState } from 'react';

import { exportVideo, type ExportOutcome, type ExportResolution } from '@/engine/export';
import { localizeProject } from '@/engine/localization';
import type { Format } from '@/engine/types';
import { deviceExportCap } from '@/lib/device';
import { logEvent } from '@/lib/events';
import { isPro, PLAN_LIMITS } from '@/lib/plan';
import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '@/store/editorStore';

/** Resolution tiers ordered smallest-to-largest, for capping a request
 * against a plan's maximum. */
const RESOLUTION_RANK: Record<ExportResolution, number> = { '720p': 0, '1080p': 1, '4k': 2 };

export interface FormatResult {
  format: Format;
  status: 'queued' | 'rendering' | 'done' | 'error';
  progress: number;
  outcome?: ExportOutcome;
  error?: string;
  /** Set when a translation (not the source language) was exported — goes in the filename. */
  locale?: string;
}

/** Renders one video per selected format, sequentially — two concurrent
 * WebCodecs/MediaRecorder passes would fight over the same encode budget,
 * and the exact same real single-format pipeline (exportVideo) runs once
 * per format with a cloned project ({...project, format}), so a 1-format
 * export behaves exactly as it always has. */
export function useVideoExport() {
  const [exporting, setExporting] = useState(false);
  const [results, setResults] = useState<FormatResult[]>([]);
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async (formats: Format[], requestedResolution: ExportResolution) => {
    // Exports the language being previewed (localization.ts) — the source
    // language, or the project as-is when it has no other languages.
    const { assets, plan, previewLocale } = useEditorStore.getState();
    const project = localizeProject(useEditorStore.getState().project, previewLocale);

    // Enforced here (not just disabled in the UI) as a last line of
    // defense — export runs entirely client-side, so this can't be a true
    // security boundary, but it does mean a free user can never actually
    // get a higher-than-720p file out of this code path regardless of how
    // the request got here.
    // ...and on a phone, never above 720p (src/lib/device.ts).
    const maxResolution = deviceExportCap(PLAN_LIMITS[plan].maxExportResolution);
    const resolution = RESOLUTION_RANK[requestedResolution] > RESOLUTION_RANK[maxResolution] ? maxResolution : requestedResolution;

    const controller = new AbortController();
    controllerRef.current = controller;
    setExporting(true);
    const locale = project.localization && project.renderLocale && project.renderLocale.locale !== project.localization.source ? project.renderLocale.locale : undefined;
    setResults(formats.map((format) => ({ format, status: 'queued', progress: 0, locale })));

    for (const format of formats) {
      if (controller.signal.aborted) break;
      setResults((prev) => prev.map((r) => (r.format === format ? { ...r, status: 'rendering' } : r)));
      try {
        const outcome = await exportVideo({ ...project, format }, assets.images, assets.audio, { resolution, watermark: !isPro(plan) }, controller.signal, (done, total) => {
          const progress = Math.min(100, (done / total) * 100);
          setResults((prev) => prev.map((r) => (r.format === format ? { ...r, progress } : r)));
        });
        setResults((prev) => prev.map((r) => (r.format === format ? { ...r, status: 'done', progress: 100, outcome } : r)));
        void logEvent(createClient(), 'export_completed', { resolution, format, method: outcome.method, sizeBytes: outcome.sizeBytes, seconds: outcome.seconds });
      } catch (err) {
        const message = err instanceof DOMException && err.name === 'AbortError' ? 'Canceled.' : err instanceof Error ? err.message : 'Export failed.';
        setResults((prev) => prev.map((r) => (r.format === format ? { ...r, status: 'error', error: message } : r)));
        if (err instanceof DOMException && err.name === 'AbortError') break;
      }
    }

    setExporting(false);
    controllerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { exporting, results, start, cancel };
}
