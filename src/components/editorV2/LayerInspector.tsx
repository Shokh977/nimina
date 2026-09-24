'use client';

import { useRef } from 'react';

import { FCOLORS, MODELS, type ModelKey } from '@/engine2/deviceFrame';
import { createClient } from '@/lib/supabase/client';
import { uploadAsset } from '@/lib/supabase/storage';
import { useEditorV2Store } from '@/store/editorV2Store';
import PresetsPanel from './PresetsPanel';
import { buttonStyle, color, font, inputStyle, sectionHeadingStyle, space } from './tokens';

const MODEL_IDS = Object.keys(MODELS) as ModelKey[];

/**
 * RIGHT inspector's "Layer" tab (layout rebuild) — everything about the
 * single selected layer: its own content (screenshot swap / video trim —
 * moved from MediaPanel, which only ever *adds new* layers now, see
 * AddMenu.tsx), device frame override, pose, back content (all moved from
 * LayersPanel, which is now just the tree), motion presets (embeds
 * PresetsPanel unchanged), and effects already attached to it (the
 * particle-burst list — *adding* a new burst is an AddMenu action, this
 * only manages existing ones). Renders nothing when selection isn't
 * exactly one layer; Inspector.tsx only shows this tab in that case.
 */
export default function LayerInspector({ layerId }: { layerId: string }) {
  const project = useEditorV2Store((s) => s.project);
  const projectId = useEditorV2Store((s) => s.projectId);
  const registerAsset = useEditorV2Store((s) => s.registerAsset);
  const updateVideoProps = useEditorV2Store((s) => s.updateVideoProps);
  const removeParticleBurst = useEditorV2Store((s) => s.removeParticleBurst);
  const setLayerDevice = useEditorV2Store((s) => s.setLayerDevice);
  const setLayerBase = useEditorV2Store((s) => s.setLayerBase);
  const setLayerBackContent = useEditorV2Store((s) => s.setLayerBackContent);

  const screenshotInputRef = useRef<HTMLInputElement>(null);

  if (!project) return null;
  const layer = project.layers.find((l) => l.id === layerId);
  if (!layer) return null;

  const uploadInBackground = (assetId: string, file: File | Blob) => {
    if (!projectId) return;
    uploadAsset(createClient(), projectId, assetId, file).catch((err) => console.error('[assets] upload failed', err));
  };

  const onReplaceScreenshot = async (file: File) => {
    if (layer.content.kind !== 'screenshot') return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    registerAsset(layer.content.slotId, img);
    uploadInBackground(layer.content.slotId, file);
  };

  const selectedScreenshotContent = layer.content.kind === 'screenshot' ? layer.content : undefined;
  const videoProps = layer.content.kind === 'video' ? layer.content.props : null;
  const otherScreenshotSlots = project.layers.flatMap((l) => (l.content.kind === 'screenshot' && l.id !== layer.id ? [{ layerId: l.id, label: l.label, slotId: l.content.slotId }] : []));
  const backKind = layer.backContent?.kind === 'screenshot' ? 'screenshot' : layer.backContent?.kind === 'label' ? 'label' : 'none';
  const burstsOnLayer = project.particles.filter((b) => b.originLayerId === layer.id);

  return (
    <div style={{ display: 'grid', gap: space.xl }}>
      <div style={{ fontSize: font.lg, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{layer.label}</div>

      {(selectedScreenshotContent || videoProps) && (
        <section>
          <h3 style={sectionHeadingStyle}>Content</h3>
          {selectedScreenshotContent && (
            <>
              <button style={buttonStyle()} onClick={() => screenshotInputRef.current?.click()}>
                Replace image
              </button>
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) void onReplaceScreenshot(file);
                }}
              />
            </>
          )}
          {videoProps && (
            <div style={{ display: 'grid', gap: space.sm, fontSize: font.sm }}>
              <label style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: space.sm }}>
                Trim start (s)
                <input type="number" min={0} step={0.1} value={videoProps.trimStart ?? 0} onChange={(e) => updateVideoProps(layer.id, { trimStart: Number(e.target.value) })} style={inputStyle} />
              </label>
              <label style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: space.sm }}>
                Trim end (s)
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={videoProps.trimEnd ?? ''}
                  placeholder="end of clip"
                  onChange={(e) => updateVideoProps(layer.id, { trimEnd: e.target.value === '' ? undefined : Number(e.target.value) })}
                  style={inputStyle}
                />
              </label>
              <label style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: space.sm }}>
                Speed
                <input type="number" min={0.1} max={4} step={0.1} value={videoProps.speed ?? 1} onChange={(e) => updateVideoProps(layer.id, { speed: Number(e.target.value) })} style={inputStyle} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                <input type="checkbox" checked={videoProps.freezeAt !== undefined} onChange={(e) => updateVideoProps(layer.id, { freezeAt: e.target.checked ? (videoProps.trimStart ?? 0) : null })} />
                Freeze-frame
              </label>
              {videoProps.freezeAt !== undefined && (
                <label style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', alignItems: 'center', gap: space.sm }}>
                  Freeze at (s)
                  <input type="number" min={0} step={0.1} value={videoProps.freezeAt} onChange={(e) => updateVideoProps(layer.id, { freezeAt: Number(e.target.value) })} style={inputStyle} />
                </label>
              )}
            </div>
          )}
        </section>
      )}

      {selectedScreenshotContent && (
        <section>
          <h3 style={sectionHeadingStyle}>Device frame — this screenshot only</h3>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: space.sm }}>
            <button onClick={() => setLayerDevice(layer.id, null)} style={buttonStyle(!selectedScreenshotContent.device)}>
              Project default
            </button>
            {MODEL_IDS.map((id) => (
              <button
                key={id}
                onClick={() => setLayerDevice(layer.id, { model: id, frameColor: selectedScreenshotContent.device?.frameColor ?? 'graphite' })}
                style={buttonStyle(selectedScreenshotContent.device?.model === id)}
              >
                {MODELS[id].label}
              </button>
            ))}
          </div>
          {selectedScreenshotContent.device && (
            <div style={{ display: 'flex', gap: space.sm }}>
              {FCOLORS.map((c) => (
                <button
                  key={c.id}
                  title={c.label}
                  onClick={() => setLayerDevice(layer.id, { model: selectedScreenshotContent.device!.model, frameColor: c.id })}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    padding: 0,
                    cursor: 'pointer',
                    background: c.id === 'theme' ? color.accent : c.body,
                    border: selectedScreenshotContent.device?.frameColor === c.id ? `2px solid ${color.accent}` : '1px solid rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h3 style={sectionHeadingStyle}>Pose — hand-set rotation/depth (device motion presets also write these)</h3>
        <div style={{ display: 'grid', gap: space.sm }}>
          {(
            [
              ['rx', 'Rotate X', -180, 180],
              ['ry', 'Rotate Y', -180, 180],
              ['rz', 'Rotate Z', -180, 180],
              ['z', 'Depth (z)', -400, 400],
            ] as const
          ).map(([axis, label, min, max]) => {
            const value = layer.transform[axis]?.base ?? 0;
            return (
              <label key={axis} style={{ display: 'flex', alignItems: 'center', gap: space.sm, fontSize: font.xs, opacity: 0.85 }}>
                <span style={{ width: 62, flex: 'none' }}>{label}</span>
                <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => setLayerBase(layer.id, axis, Number(e.target.value))} style={{ flex: 1 }} />
                <span style={{ width: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Math.round(value)}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section>
        <h3 style={sectionHeadingStyle}>Back content — shown when Flip to second screenshot / Flip reveal turns this layer over</h3>
        <select
          value={backKind}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'none') setLayerBackContent(layer.id, null);
            else if (v === 'screenshot') setLayerBackContent(layer.id, otherScreenshotSlots[0] ? { kind: 'screenshot', slotId: otherScreenshotSlots[0].slotId } : null);
            else setLayerBackContent(layer.id, { kind: 'label', text: 'Back' });
          }}
          style={inputStyle}
        >
          <option value="none">None</option>
          <option value="screenshot" disabled={otherScreenshotSlots.length === 0}>
            Another screenshot{otherScreenshotSlots.length === 0 ? ' (upload one first)' : ''}
          </option>
          <option value="label">Text</option>
        </select>
        {backKind === 'screenshot' && (
          <select
            value={layer.backContent?.kind === 'screenshot' ? layer.backContent.slotId : ''}
            onChange={(e) => setLayerBackContent(layer.id, { kind: 'screenshot', slotId: e.target.value })}
            style={{ ...inputStyle, marginTop: space.sm }}
          >
            {otherScreenshotSlots.map((s) => (
              <option key={s.layerId} value={s.slotId}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        {backKind === 'label' && layer.backContent?.kind === 'label' && (
          <input value={layer.backContent.text} onChange={(e) => setLayerBackContent(layer.id, { kind: 'label', text: e.target.value })} style={{ ...inputStyle, marginTop: space.sm }} />
        )}
      </section>

      <section>
        <PresetsPanel />
      </section>

      <section>
        <h3 style={sectionHeadingStyle}>Effects on this layer</h3>
        {burstsOnLayer.length === 0 ? (
          <p style={{ fontSize: font.sm, opacity: 0.5 }}>No particle bursts yet — add one from the + Add menu.</p>
        ) : (
          <div style={{ display: 'grid', gap: 4 }}>
            {burstsOnLayer.map((b) => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: font.sm, background: color.surfaceRaised, borderRadius: 6, padding: '4px 8px' }}>
                <span>
                  {b.kind} @ {b.at.toFixed(2)}s
                </span>
                <button onClick={() => removeParticleBurst(b.id)} style={{ background: 'none', border: 0, color: color.danger, cursor: 'pointer' }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
