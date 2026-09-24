'use client';

import { useMemo, useRef, useState, type PointerEvent } from 'react';

import type { Axis } from '@/engine2/types';
import { useEditorV2Store } from '@/store/editorV2Store';

const ROW_H = 28;
const LABEL_W = 130;
const SNAP_PX = 8;

/**
 * One row per layer, a diamond per keyframe (merged across all of a
 * layer's axes — the row is "when does this layer do something", not a
 * per-axis breakdown), draggable to retime; dragging the row's background
 * shifts every step on every axis together (a block move). Zoomable via
 * the pixels-per-second slider. Snaps to other layers' keyframe times and,
 * when `project.bpm` is set, to the beat grid.
 */
export default function TimelineV2() {
  const project = useEditorV2Store((s) => s.project);
  const selectedIds = useEditorV2Store((s) => s.selectedIds);
  const select = useEditorV2Store((s) => s.select);
  const playheadT = useEditorV2Store((s) => s.playheadT);
  const setPlayhead = useEditorV2Store((s) => s.setPlayhead);
  const moveLayerTiming = useEditorV2Store((s) => s.moveLayerTiming);
  const updateKeyframe = useEditorV2Store((s) => s.updateKeyframe);
  const selectedKeyframe = useEditorV2Store((s) => s.selectedKeyframe);
  const selectKeyframe = useEditorV2Store((s) => s.selectKeyframe);

  const [pxPerSec, setPxPerSec] = useState(90);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ kind: 'row'; layerId: string; startX: number } | { kind: 'kf'; layerId: string; axis: Axis; index: number } | { kind: 'playhead' } | null>(null);

  const allKeyframeTimes = useMemo(() => {
    const times: number[] = [];
    project?.layers.forEach((l) => (Object.keys(l.transform) as Axis[]).forEach((a) => l.transform[a]?.steps.forEach((s) => times.push(s.at))));
    return times;
  }, [project]);

  if (!project) return null;
  const proj = project;
  const duration = proj.duration;

  const beatGrid = proj.bpm ? 60 / proj.bpm : null;

  function snapTime(t: number, excludeLayerId?: string): number {
    const pxThresholdSec = SNAP_PX / pxPerSec;
    let best = t;
    let bestDist = pxThresholdSec;
    if (beatGrid) {
      const nearest = Math.round(t / beatGrid) * beatGrid;
      if (Math.abs(nearest - t) < bestDist) {
        best = nearest;
        bestDist = Math.abs(nearest - t);
      }
    }
    proj.layers.forEach((l) => {
      if (l.id === excludeLayerId) return;
      (Object.keys(l.transform) as Axis[]).forEach((a) =>
        l.transform[a]?.steps.forEach((s) => {
          if (Math.abs(s.at - t) < bestDist) {
            best = s.at;
            bestDist = Math.abs(s.at - t);
          }
        }),
      );
    });
    return Math.max(0, best);
  }

  const xAt = (t: number) => LABEL_W + t * pxPerSec;
  const tAt = (x: number) => Math.max(0, (x - LABEL_W) / pxPerSec);

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (d.kind === 'playhead') {
      setPlayhead(Math.max(0, Math.min(duration, tAt(x))));
    } else if (d.kind === 'kf') {
      const t = snapTime(tAt(x), d.layerId);
      updateKeyframe(d.layerId, d.axis, d.index, { at: t });
    } else if (d.kind === 'row') {
      const deltaPx = x - d.startX;
      const deltaSec = deltaPx / pxPerSec;
      if (Math.abs(deltaPx) > 1) {
        moveLayerTiming(d.layerId, deltaSec);
        drag.current = { ...d, startX: x };
      }
    }
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, margin: 0 }}>Timeline</h3>
        <span style={{ fontSize: 11, opacity: 0.6 }}>Zoom</span>
        <input type="range" min={30} max={240} value={pxPerSec} onChange={(e) => setPxPerSec(Number(e.target.value))} style={{ width: 100 }} />
        {beatGrid && <span style={{ fontSize: 10.5, opacity: 0.5 }}>Snapping to {proj.bpm} BPM</span>}
      </div>
      <div
        ref={trackRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ position: 'relative', overflowX: 'auto', background: '#111117', borderRadius: 8, userSelect: 'none' }}
      >
        {/* Playhead scrub bar */}
        <div
          onPointerDown={(e) => {
            drag.current = { kind: 'playhead' };
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          style={{ height: 18, position: 'relative', cursor: 'ew-resize', borderBottom: '1px solid #26262f' }}
        >
          {allKeyframeTimes.length === 0 && <span style={{ position: 'absolute', left: LABEL_W + 4, top: 2, fontSize: 10, opacity: 0.4 }}>drag to scrub</span>}
        </div>
        <div
          style={{ position: 'absolute', top: 0, bottom: 0, width: 2, background: '#FFD23F', left: xAt(playheadT), pointerEvents: 'none', zIndex: 5 }}
        />
        {proj.layers.map((l) => {
          const kfs: Array<{ axis: Axis; index: number; at: number }> = [];
          (Object.keys(l.transform) as Axis[]).forEach((a) => l.transform[a]?.steps.forEach((s, i) => kfs.push({ axis: a, index: i, at: s.at })));
          const selected = selectedIds.includes(l.id);
          const minT = kfs.length ? Math.min(...kfs.map((k) => k.at)) : 0;
          const maxT = kfs.length ? Math.max(...kfs.map((k) => k.at)) : 0;
          return (
            <div key={l.id} style={{ display: 'flex', height: ROW_H, alignItems: 'center', borderBottom: '1px solid #1c1c24', background: selected ? 'rgba(109,91,255,0.12)' : 'transparent' }}>
              <div
                onClick={() => select([l.id])}
                style={{ width: LABEL_W, flex: 'none', fontSize: 11, padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
              >
                {l.label}
              </div>
              <div style={{ position: 'relative', flex: 1, height: '100%', minWidth: 400 }}>
                {kfs.length > 1 && (
                  <div
                    onPointerDown={(e) => {
                      drag.current = { kind: 'row', layerId: l.id, startX: e.clientX - (trackRef.current?.getBoundingClientRect().left ?? 0) };
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    style={{
                      position: 'absolute',
                      left: xAt(minT) - LABEL_W,
                      width: Math.max(4, (maxT - minT) * pxPerSec),
                      top: ROW_H / 2 - 3,
                      height: 6,
                      background: 'rgba(109,91,255,0.35)',
                      borderRadius: 3,
                      cursor: 'grab',
                    }}
                  />
                )}
                {kfs.map((k) => (
                  <div
                    key={`${k.axis}-${k.index}`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      select([l.id]);
                      selectKeyframe({ layerId: l.id, axis: k.axis, index: k.index });
                      drag.current = { kind: 'kf', layerId: l.id, axis: k.axis, index: k.index };
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    title={`${k.axis} @ ${k.at.toFixed(2)}s`}
                    style={{
                      position: 'absolute',
                      left: xAt(k.at) - LABEL_W - 5,
                      top: ROW_H / 2 - 5,
                      width: 10,
                      height: 10,
                      transform: 'rotate(45deg)',
                      background: selectedKeyframe?.layerId === l.id && selectedKeyframe.axis === k.axis && selectedKeyframe.index === k.index ? '#FFD23F' : '#6D5BFF',
                      border: '1.5px solid #fff',
                      cursor: 'ew-resize',
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
