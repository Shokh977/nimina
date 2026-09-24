'use client';

import { listPresets, type PresetCategory, type PresetTag } from '@/engine2/presets';
import { useEditorV2Store } from '@/store/editorV2Store';

const CATEGORIES: PresetCategory[] = ['enter', 'idle', 'emphasis', 'exit'];
const CATEGORY_LABEL: Record<PresetCategory, string> = { enter: 'Enter', idle: 'Idle (loops)', emphasis: 'Emphasis', exit: 'Exit' };

/** One-click Enter/Idle/Emphasis/Exit presets — applies to every selected
 * layer at once, auto-staggered by selection order (editorV2Store's
 * applyPreset, MOTION_GUIDE.md's 40-70ms rule). Beginners never need to see
 * a keyframe to use this; the Timeline/CurveEditor panels are what expose
 * the keyframes a preset just wrote, for anyone who wants to go further.
 *
 * Shown presets are filtered by tag to match the current selection (Tier 1
 * "device motion presets" — a picker cluttered with every preset regardless
 * of what's selected would bury the curated device/cutout ones among
 * generic layer presets that don't suit them as well). 'generic' always
 * shows; 'device'/'cutout' show only when every selected layer matches —
 * this is a display filter only, never enforced by applyPreset itself. */
export default function PresetsPanel() {
  const project = useEditorV2Store((s) => s.project);
  const selectedIds = useEditorV2Store((s) => s.selectedIds);
  const playheadT = useEditorV2Store((s) => s.playheadT);
  const applyPreset = useEditorV2Store((s) => s.applyPreset);
  const applyCutoutTrail = useEditorV2Store((s) => s.applyCutoutTrail);

  if (!project) return null;
  const disabled = selectedIds.length === 0;
  const selectedLayers = project.layers.filter((l) => selectedIds.includes(l.id));
  const activeTags: PresetTag[] = ['generic'];
  if (selectedLayers.length > 0 && selectedLayers.every((l) => l.plane === 'device')) activeTags.push('device');
  if (selectedLayers.length > 0 && selectedLayers.every((l) => !!l.liftOf)) activeTags.push('cutout');
  // "Trail" (Tier 1 part C) isn't a keyframe preset — it creates ghost
  // duplicate layers (editorV2Store's applyCutoutTrail), so it can't go
  // through the generic apply(layer,at) preset mechanism above and needs
  // exactly one cutout layer selected (ghosts are relative to one leader).
  const trailEligible = selectedIds.length === 1 && !!selectedLayers[0]?.liftOf;

  return (
    <div>
      <h3 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, margin: '0 0 6px' }}>Presets</h3>
      {disabled && <p style={{ fontSize: 11, opacity: 0.5, margin: '0 0 8px' }}>Select one or more layers to apply a preset.</p>}
      {!disabled && !activeTags.includes('device') && !activeTags.includes('cutout') && (
        <p style={{ fontSize: 11, opacity: 0.5, margin: '0 0 8px' }}>
          Select a device-frame layer (or a cutout) to also see its curated motion presets here — right now only the generic ones are shown.
        </p>
      )}
      {CATEGORIES.map((cat) => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10.5, opacity: 0.55, marginBottom: 4 }}>{CATEGORY_LABEL[cat]}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {listPresets(cat)
              .filter((p) => p.tags.some((t) => activeTags.includes(t)))
              .map((p) => (
                <button
                  key={p.id}
                  disabled={disabled}
                  title={p.description}
                  onClick={() => applyPreset(selectedIds, p.id, cat === 'exit' ? Math.max(0, project.duration - 0.6) : playheadT)}
                  style={{
                    fontSize: 11.5,
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: '1px solid #33333f',
                    background: '#1A1A22',
                    color: '#fff',
                    opacity: disabled ? 0.4 : 1,
                    cursor: disabled ? 'default' : 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
          </div>
        </div>
      ))}
      {trailEligible && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10.5, opacity: 0.55, marginBottom: 4 }}>Cutout (creates layers)</div>
          <button
            title="Adds 2 fading ghost duplicates behind this cutout, each showing its motion slightly delayed."
            onClick={() => applyCutoutTrail(selectedIds[0], 2)}
            style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 8, border: '1px solid #33333f', background: '#1A1A22', color: '#fff', cursor: 'pointer' }}
          >
            Trail
          </button>
        </div>
      )}
    </div>
  );
}
