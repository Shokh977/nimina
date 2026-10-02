'use client';

import { useEffect, useRef, useState } from 'react';

import { renderStill } from '@/engine/export';
import type { AssetMap, Project } from '@/engine/types';

/** Small live render of one slide frozen at `t`, laid out for a
 * `width` x `height` output — the same renderStill() the export uses, just
 * at thumbnail resolution, so what's shown is what gets exported (crops
 * included). */
export default function StillPreview({
  project,
  images,
  slideId,
  t,
  width,
  height,
  watermark,
  displayWidth,
}: {
  project: Project;
  images: AssetMap;
  slideId: number;
  t: number;
  width: number;
  height: number;
  watermark: boolean;
  displayWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontEpoch, setFontEpoch] = useState(0);
  const displayHeight = Math.round((displayWidth * height) / width);

  useEffect(() => {
    // Re-render once late-loading fonts arrive, otherwise the first paint
    // can stick with fallback-font metrics.
    const bump = () => setFontEpoch((n) => n + 1);
    document.fonts.addEventListener('loadingdone', bump);
    return () => document.fonts.removeEventListener('loadingdone', bump);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.round(displayWidth * dpr);
    const ch = Math.round(cw * (height / width));
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    renderStill(ctx, project, images, slideId, t, cw, ch, { watermark });
  }, [project, images, slideId, t, width, height, watermark, displayWidth, fontEpoch]);

  return <canvas ref={canvasRef} style={{ width: displayWidth, height: displayHeight }} className="block rounded-[6px] bg-black/40" />;
}
