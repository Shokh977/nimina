'use client';

import { useCallback, useRef, useState } from 'react';

import { exportVideo, type ExportOutcome, type ExportResolution } from '@/engine/export';
import { logEvent } from '@/lib/events';
import { isPro, PLAN_LIMITS } from '@/lib/plan';
import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '@/store/editorStore';

/** Resolution tiers ordered smallest-to-largest, for capping a request
 * against a plan's maximum. */
const RESOLUTION_RANK: Record<ExportResolution, number> = { '720p': 0, '1080p': 1, '4k': 2 };

export function useVideoExport() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Renders offline as fast as your device allows, then falls back to real-time recording if needed.');
  const [result, setResult] = useState<ExportOutcome | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const start = useCallback(async (requestedResolution: ExportResolution) => {
    const { project, assets, plan } = useEditorStore.getState();
    const musicBuffer = project.music ? (assets.audio[project.music.assetId] ?? null) : null;

    // Enforced here (not just disabled in the UI) as a last line of
    // defense — export runs entirely client-side, so this can't be a true
    // security boundary, but it does mean a free user can never actually
    // get a higher-than-720p file out of this code path regardless of how
    // the request got here.
    const maxResolution = PLAN_LIMITS[plan].maxExportResolution;
    const resolution = RESOLUTION_RANK[requestedResolution] > RESOLUTION_RANK[maxResolution] ? maxResolution : requestedResolution;

    const controller = new AbortController();
    controllerRef.current = controller;
    setExporting(true);
    setResult(null);
    setProgress(0);
    setStatus('Rendering frames…');

    try {
      const res = await exportVideo(project, assets.images, musicBuffer, { resolution, watermark: !isPro(plan) }, controller.signal, (done, total) => {
        setProgress(Math.min(100, (done / total) * 100));
      });
      setResult(res);
      const base = `Done: ${res.ext.toUpperCase()}, ${(res.sizeBytes / 1048576).toFixed(1)} MB, ${res.seconds.toFixed(1)} seconds.`;
      setStatus(res.fallbackReason ? `${res.fallbackReason} ${base}` : base);
      void logEvent(createClient(), 'export_completed', { resolution, method: res.method, sizeBytes: res.sizeBytes, seconds: res.seconds });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setStatus('Export canceled.');
      } else {
        setStatus(err instanceof Error ? err.message : 'Export failed.');
      }
    } finally {
      setExporting(false);
      controllerRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  return { exporting, progress, status, result, start, cancel };
}
