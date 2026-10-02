'use client';

import { zipSync } from 'fflate';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ensureProjectFonts, renderStillBlob, stillTimeFor, type StillFileFormat } from '@/engine/export';
import { localizeProject } from '@/engine/localization';
import { slug } from '@/engine/utils';
import { logEvent } from '@/lib/events';
import { PLAN_LIMITS } from '@/lib/plan';
import { createClient } from '@/lib/supabase/client';
import { useEditorStore } from '@/store/editorStore';

/** One output size: a store preset (key = its id) or the custom size
 * (key = 'custom-{w}x{h}'). `key` is what goes in the filename. */
export interface StillTarget {
  key: string;
  label: string;
  width: number;
  height: number;
  custom?: boolean;
}

export interface StillFile {
  name: string;
  url: string;
  sizeBytes: number;
  width: number;
  height: number;
  targetKey: string;
}

/** Pixel size actually rendered for a target on a plan — free renders at
 * PLAN_LIMITS.free.imageExport.scale of the store size. */
export function planDimensions(target: StillTarget, scale: number): { width: number; height: number } {
  return { width: Math.round(target.width * scale), height: Math.round(target.height * scale) };
}

/** Renders every selected slide at every selected size, one image at a
 * time (each 2-4K canvas + PNG encode is ~100MB of transient memory, so no
 * parallelism), then bundles them into a ZIP. */
export function useImageExport() {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [files, setFiles] = useState<StillFile[]>([]);
  const [zip, setZip] = useState<{ name: string; url: string; sizeBytes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const urlsRef = useRef<string[]>([]);

  const revokeAll = () => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
  };
  useEffect(() => revokeAll, []);

  const start = useCallback(async (slideIds: number[], requestedTargets: StillTarget[], format: StillFileFormat, quality: number) => {
    // The language being previewed (see useVideoExport).
    const { assets, plan, previewLocale } = useEditorStore.getState();
    const project = localizeProject(useEditorStore.getState().project, previewLocale);
    const localeTag = project.localization && project.renderLocale && project.renderLocale.locale !== project.localization.source ? `-${project.renderLocale.locale}` : '';
    // Enforced here as well as in the UI — same last-line-of-defense
    // reasoning (and the same client-side caveat) as useVideoExport.
    const limits = PLAN_LIMITS[plan].imageExport;
    const targets = requestedTargets.filter((t) => limits.customSize || !t.custom).slice(0, limits.maxPresets);
    const slides = slideIds.map((id) => project.scenes.find((s) => s.id === id)).filter((s) => s != null && !s.hidden);
    if (!targets.length || !slides.length) return;

    const controller = new AbortController();
    controllerRef.current = controller;
    revokeAll();
    setFiles([]);
    setZip(null);
    setError(null);
    setExporting(true);
    const total = targets.length * slides.length;
    setProgress({ done: 0, total });

    const appSlug = slug(project.appName);
    const ext = format === 'png' ? 'png' : 'jpg';
    const out: StillFile[] = [];
    const zipEntries: Record<string, Uint8Array> = {};
    try {
      await ensureProjectFonts(project);
      for (const target of targets) {
        const { width, height } = planDimensions(target, limits.scale);
        for (let i = 0; i < slides.length; i++) {
          if (controller.signal.aborted) throw new DOMException('Export canceled', 'AbortError');
          const slide = slides[i]!;
          const blob = await renderStillBlob(project, assets.images, slide.id, stillTimeFor(project, slide), width, height, { format, quality, watermark: PLAN_LIMITS[plan].watermark });
          const name = `${appSlug}${localeTag}-${target.key}-${String(i + 1).padStart(2, '0')}.${ext}`;
          const url = URL.createObjectURL(blob);
          urlsRef.current.push(url);
          out.push({ name, url, sizeBytes: blob.size, width, height, targetKey: target.key });
          zipEntries[name] = new Uint8Array(await blob.arrayBuffer());
          setFiles([...out]);
          setProgress({ done: out.length, total });
          // Let progress paint and Cancel register between images.
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      // PNG/JPG are already compressed — store, don't deflate again.
      const zipped = zipSync(zipEntries, { level: 0 });
      const zipBlob = new Blob([zipped as BlobPart], { type: 'application/zip' });
      const zipUrl = URL.createObjectURL(zipBlob);
      urlsRef.current.push(zipUrl);
      setZip({ name: `${appSlug}-screenshots.zip`, url: zipUrl, sizeBytes: zipBlob.size });
      void logEvent(createClient(), 'images_exported', { count: out.length, targets: targets.map((t) => t.key), format });
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'AbortError' ? 'Canceled.' : err instanceof Error ? err.message : 'Export failed.');
    }
    setExporting(false);
    controllerRef.current = null;
  }, []);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  return { exporting, progress, files, zip, error, start, cancel };
}
