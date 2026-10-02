'use client';

import { zipSync } from 'fflate';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ensureProjectFonts, exportVideo, renderStillBlob, stillTimeFor, type ExportResolution } from '@/engine/export';
import { localizeProject } from '@/engine/localization';
import type { Format } from '@/engine/types';
import { slug } from '@/engine/utils';
import { logEvent } from '@/lib/events';
import { PLAN_LIMITS } from '@/lib/plan';
import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '@/store/editorStore';
import '@/components/scriptFontLoader';
import { planDimensions, type StillTarget } from './useImageExport';

const RESOLUTION_RANK: Record<ExportResolution, number> = { '720p': 0, '1080p': 1, '4k': 2 };

export interface LanguageProgress {
  locale: string;
  status: 'queued' | 'rendering' | 'done' | 'error' | 'canceled';
  /** 0-100 across this language's videos and images. */
  progress: number;
  step: string;
  files: number;
  error?: string;
}

export interface BatchRequest {
  locales: string[];
  videoFormats: Format[];
  resolution: ExportResolution;
  imageTargets: StillTarget[];
  slideIds: number[];
}

const abortError = () => new DOMException('Export canceled', 'AbortError');

/**
 * Exports every selected language in one run — each language's videos
 * (one per format) and/or its store image set — into one ZIP with a
 * folder per locale:
 *   {app-slug}-{locale}/{app-slug}-{locale}-{9x16}.mp4
 *   {app-slug}-{locale}/{app-slug}-{locale}-{preset}-{01}.png
 * Languages run one after another (each video export already uses the
 * whole encode budget); Cancel stops after the current frame/image.
 */
export function useBatchExport() {
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<LanguageProgress[]>([]);
  const [zip, setZip] = useState<{ name: string; url: string; sizeBytes: number } | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const zipUrlRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
    },
    [],
  );

  const start = useCallback(async (req: BatchRequest) => {
    const { project: base, assets, plan } = useEditorStore.getState();
    const limits = PLAN_LIMITS[plan];
    // Same plan enforcement as the single-language exports.
    const locales = req.locales.filter((l) => base.localization?.languages.some((x) => x.locale === l)).slice(0, limits.maxLanguages);
    const resolution = RESOLUTION_RANK[req.resolution] > RESOLUTION_RANK[limits.maxExportResolution] ? limits.maxExportResolution : req.resolution;
    const targets = req.imageTargets.filter((t) => limits.imageExport.customSize || !t.custom).slice(0, limits.imageExport.maxPresets);
    if (!locales.length || (!req.videoFormats.length && !targets.length)) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    if (zipUrlRef.current) URL.revokeObjectURL(zipUrlRef.current);
    zipUrlRef.current = null;
    setZip(null);
    setRunning(true);
    setRows(locales.map((locale) => ({ locale, status: 'queued', progress: 0, step: '', files: 0 })));
    const patch = (locale: string, p: Partial<LanguageProgress>) => setRows((prev) => prev.map((r) => (r.locale === locale ? { ...r, ...p } : r)));

    const appSlug = slug(base.appName);
    const entries: Record<string, Uint8Array> = {};
    const musicBuffer = base.music ? (assets.audio[base.music.assetId] ?? null) : null;

    for (const locale of locales) {
      if (controller.signal.aborted) {
        patch(locale, { status: 'canceled', step: 'Canceled' });
        continue;
      }
      const project = localizeProject(base, locale);
      const slides = req.slideIds.map((id) => project.scenes.find((s) => s.id === id)).filter((s) => s != null && !s.hidden);
      const units = req.videoFormats.length * 100 + targets.length * slides.length * 10; // a video ~ 10 images of work
      let doneUnits = 0;
      const folder = `${appSlug}-${locale}`;
      // Committed to the ZIP only once the whole language succeeds — a
      // canceled or failed language contributes no partial set.
      const langEntries: Record<string, Uint8Array> = {};
      let files = 0;
      patch(locale, { status: 'rendering', step: 'Loading fonts' });
      try {
        await ensureProjectFonts(project);
        for (const format of req.videoFormats) {
          if (controller.signal.aborted) throw abortError();
          patch(locale, { step: `Video ${format}` });
          const outcome = await exportVideo({ ...project, format }, assets.images, musicBuffer, { resolution, watermark: limits.watermark }, controller.signal, (d, t) =>
            patch(locale, { progress: ((doneUnits + (d / t) * 100) / units) * 100 }),
          );
          langEntries[`${folder}/${appSlug}-${locale}-${format.replace(':', 'x')}.${outcome.ext}`] = new Uint8Array(await outcome.blob.arrayBuffer());
          URL.revokeObjectURL(outcome.url);
          doneUnits += 100;
          patch(locale, { files: ++files });
        }
        for (const target of targets) {
          const { width, height } = planDimensions(target, limits.imageExport.scale);
          for (let i = 0; i < slides.length; i++) {
            if (controller.signal.aborted) throw abortError();
            const slide = slides[i]!;
            patch(locale, { step: `${target.label} ${i + 1}/${slides.length}` });
            const blob = await renderStillBlob(project, assets.images, slide.id, stillTimeFor(project, slide), width, height, { format: 'png', quality: 1, watermark: limits.watermark });
            langEntries[`${folder}/${appSlug}-${locale}-${target.key}-${String(i + 1).padStart(2, '0')}.png`] = new Uint8Array(await blob.arrayBuffer());
            doneUnits += 10;
            patch(locale, { files: ++files, progress: (doneUnits / units) * 100 });
            await new Promise((r) => setTimeout(r, 0));
          }
        }
        Object.assign(entries, langEntries);
        patch(locale, { status: 'done', progress: 100, step: 'Done' });
      } catch (err) {
        const canceled = err instanceof DOMException && err.name === 'AbortError';
        patch(locale, canceled ? { status: 'canceled', step: 'Canceled' } : { status: 'error', step: 'Failed', error: err instanceof Error ? err.message : 'Export failed.' });
      }
    }

    // A canceled run still delivers the languages it completed.
    if (Object.keys(entries).length) {
      const blob = new Blob([zipSync(entries, { level: 0 }) as BlobPart], { type: 'application/zip' });
      zipUrlRef.current = URL.createObjectURL(blob);
      setZip({ name: `${appSlug}-all-languages.zip`, url: zipUrlRef.current, sizeBytes: blob.size });
      void logEvent(createClient(), 'batch_exported', { locales, videoFormats: req.videoFormats, images: targets.map((t) => t.key), files: Object.keys(entries).length });
    }
    setRunning(false);
    controllerRef.current = null;
  }, []);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);
  return { running, rows, zip, start, cancel };
}
