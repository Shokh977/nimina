'use client';

import { useCallback, useRef } from 'react';

import { resolveStyle } from '@/engine/render';
import type { Project, Segment } from '@/engine/types';

/** Segment track + playhead, styled like the prototype's `#track`. Clicking
 * or dragging anywhere on it seeks to that time. */
export default function Timeline({ project, segments, total, t, onSeek }: { project: Project; segments: Segment[]; total: number; t: number; onSeek: (t: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el || total <= 0) return;
      const r = el.getBoundingClientRect();
      onSeek(((clientX - r.left) / r.width) * total);
    },
    [total, onSeek],
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      aria-label="Timeline, drag to scrub"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={t}
      className="relative flex h-[38px] flex-1 touch-none gap-[3px] select-none"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        seekFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons !== 1) return;
        seekFromClientX(e.clientX);
      }}
    >
      {segments.map((seg, i) => {
        const active = t >= seg.start && t < seg.start + seg.dur;
        const style = resolveStyle(project, seg.owner);
        return (
          <div
            key={i}
            style={{ flex: `${seg.dur} 1 0`, borderBottomColor: style.colors.a }}
            className={`flex min-w-0 items-center overflow-hidden rounded-md border-b-[3px] px-2 text-[12px] font-semibold whitespace-nowrap ${
              active ? 'bg-[#3A4260] text-white' : seg.type === 'scene' ? 'bg-[#2E3444] text-neutral-400' : 'bg-neutral-700 text-neutral-400'
            }`}
          >
            {seg.label}
          </div>
        );
      })}
      <div
        className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded-sm bg-[#FFD23F] shadow-[0_0_0_3px_rgba(255,210,63,.18)]"
        style={{ left: total ? `calc(${(t / total) * 100}% - 1px)` : '0' }}
      />
    </div>
  );
}
