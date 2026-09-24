'use client';

import { useRef, type PointerEvent } from 'react';

import { cubicBezier } from '@/engine2/bezier';
import { SP, type SpringPresetId } from '@/engine2/spring';
import type { CubicBezier } from '@/engine2/types';
import { useEditorV2Store } from '@/store/editorV2Store';

const SIZE = 160;
const PAD = 12;

function springPreview(spring: SpringPresetId): string {
  const p = SP[spring];
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * 1.1;
    const w = Math.sqrt(p.k);
    const z = p.c / (2 * w);
    const wd = w * Math.sqrt(Math.max(0, 1 - z * z));
    const v = z < 1 ? 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t)) : 1 - Math.exp(-w * t) * (1 + w * t);
    const x = PAD + (i / 40) * (SIZE - PAD * 2);
    const y = SIZE - PAD - Math.max(-0.3, Math.min(1.3, v)) * (SIZE - PAD * 2) * 0.75;
    pts.push(`${x},${y}`);
  }
  return pts.join(' ');
}

/**
 * The "advanced" half of Prompt 5's presets story: beginners apply a
 * preset and never see this; anyone who wants to refine the selected
 * keyframe's timing can either pick a different named spring or drop into
 * a real draggable cubic-bezier curve (dragging either handle rewrites
 * `easing`/`dur` on the step — see editorV2Store's updateKeyframe).
 */
export default function CurveEditor() {
  const project = useEditorV2Store((s) => s.project);
  const selectedKeyframe = useEditorV2Store((s) => s.selectedKeyframe);
  const updateKeyframe = useEditorV2Store((s) => s.updateKeyframe);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragHandle = useRef<1 | 2 | null>(null);

  if (!project || !selectedKeyframe) {
    return <p style={{ fontSize: 11, opacity: 0.5 }}>Select a keyframe on the timeline to edit its curve.</p>;
  }
  const { layerId, axis, index } = selectedKeyframe;
  const layer = project.layers.find((l) => l.id === layerId);
  const step = layer?.transform[axis]?.steps[index];
  if (!layer || !step) return null;

  const usesBezier = !!step.easing;
  const curve: CubicBezier = step.easing ?? [0.42, 0, 0.58, 1];

  const toSvg = (x: number, y: number) => [PAD + x * (SIZE - PAD * 2), SIZE - PAD - y * (SIZE - PAD * 2)];
  const fromSvg = (px: number, py: number): [number, number] => [Math.max(0, Math.min(1, (px - PAD) / (SIZE - PAD * 2))), Math.max(-0.4, Math.min(1.4, (SIZE - PAD - py) / (SIZE - PAD * 2)))];

  const [h1x, h1y] = toSvg(curve[0], curve[1]);
  const [h2x, h2y] = toSvg(curve[2], curve[3]);

  const onPointerMove = (e: PointerEvent) => {
    const handle = dragHandle.current;
    if (!handle || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const [x, y] = fromSvg(e.clientX - rect.left, e.clientY - rect.top);
    const next: CubicBezier = handle === 1 ? [x, y, curve[2], curve[3]] : [curve[0], curve[1], x, y];
    updateKeyframe(layerId, axis, index, { easing: next });
  };

  const curvePath = Array.from({ length: 24 }, (_, i) => {
    const x = i / 23;
    const y = cubicBezier(x, curve);
    const [px, py] = toSvg(x, y);
    return `${i === 0 ? 'M' : 'L'}${px},${py}`;
  }).join(' ');

  return (
    <div>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
        {layer.label} · {axis} keyframe @ {step.at.toFixed(2)}s
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          onClick={() => updateKeyframe(layerId, axis, index, { easing: undefined })}
          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #33333f', background: !usesBezier ? '#6D5BFF' : '#1A1A22', color: '#fff' }}
        >
          Spring
        </button>
        <button
          onClick={() => updateKeyframe(layerId, axis, index, { easing: curve, dur: step.dur ?? 0.5 })}
          style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: '1px solid #33333f', background: usesBezier ? '#6D5BFF' : '#1A1A22', color: '#fff' }}
        >
          Bezier
        </button>
      </div>

      {!usesBezier ? (
        <div>
          <select
            value={step.spring}
            onChange={(e) => updateKeyframe(layerId, axis, index, { spring: e.target.value as SpringPresetId })}
            style={{ background: '#1A1A22', color: '#fff', border: '1px solid #33333f', borderRadius: 6, padding: '4px 8px', fontSize: 12, marginBottom: 8 }}
          >
            {Object.keys(SP).map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <svg width={SIZE} height={SIZE} style={{ background: '#111117', borderRadius: 8 }}>
            <polyline points={springPreview(step.spring)} fill="none" stroke="#6D5BFF" strokeWidth={2} />
          </svg>
        </div>
      ) : (
        <div>
          <label style={{ display: 'block', fontSize: 11, opacity: 0.6, marginBottom: 6 }}>
            Duration (s)
            <input
              type="number"
              min={0.05}
              max={3}
              step={0.05}
              value={step.dur ?? 0.5}
              onChange={(e) => updateKeyframe(layerId, axis, index, { dur: Number(e.target.value) })}
              style={{ display: 'block', width: 80, marginTop: 3, background: '#1A1A22', color: '#fff', border: '1px solid #33333f', borderRadius: 6, padding: '3px 6px', fontSize: 12 }}
            />
          </label>
          <svg
            ref={svgRef}
            width={SIZE}
            height={SIZE}
            style={{ background: '#111117', borderRadius: 8, touchAction: 'none' }}
            onPointerMove={onPointerMove}
            onPointerUp={() => {
              dragHandle.current = null;
            }}
          >
            <line x1={PAD} y1={SIZE - PAD} x2={SIZE - PAD} y2={PAD} stroke="#2a2a33" strokeDasharray="3 3" />
            <path d={curvePath} fill="none" stroke="#6D5BFF" strokeWidth={2} />
            <line x1={PAD} y1={SIZE - PAD} x2={h1x} y2={h1y} stroke="#FFD23F" strokeWidth={1} />
            <line x1={SIZE - PAD} y1={PAD} x2={h2x} y2={h2y} stroke="#FFD23F" strokeWidth={1} />
            <circle cx={h1x} cy={h1y} r={6} fill="#FFD23F" onPointerDown={() => (dragHandle.current = 1)} style={{ cursor: 'grab' }} />
            <circle cx={h2x} cy={h2y} r={6} fill="#FFD23F" onPointerDown={() => (dragHandle.current = 2)} style={{ cursor: 'grab' }} />
          </svg>
        </div>
      )}
    </div>
  );
}
