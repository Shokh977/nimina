'use client';

import type { MouseEvent, CSSProperties } from 'react';

import type { LayerDef } from '@/engine2/types';
import { useEditorV2Store } from '@/store/editorV2Store';
import { color, font, radius, sectionHeadingStyle, space } from './tokens';

const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: radius.sm, fontSize: font.base };
const iconBtn: CSSProperties = { background: 'none', border: 0, color: 'inherit', cursor: 'pointer', width: 22, height: 22, display: 'grid', placeItems: 'center', opacity: 0.85, fontSize: 13 };

/**
 * Layers panel — LEFT zone (layout rebuild): just the layer tree —
 * reorder, show/hide, lock, group, parent-to-device-screen. Per-layer
 * property editing (pose, device frame, back content, presets, effects)
 * lives in the RIGHT inspector's Layer tab now (Inspector.tsx), which
 * follows whatever's selected here — this panel's only job is picking
 * what's selected, not editing it.
 */
export default function LayersPanel() {
  const project = useEditorV2Store((s) => s.project);
  const selectedIds = useEditorV2Store((s) => s.selectedIds);
  const select = useEditorV2Store((s) => s.select);
  const reorderLayer = useEditorV2Store((s) => s.reorderLayer);
  const toggleVisible = useEditorV2Store((s) => s.toggleVisible);
  const toggleLock = useEditorV2Store((s) => s.toggleLock);
  const setPlane = useEditorV2Store((s) => s.setPlane);
  const removeLayer = useEditorV2Store((s) => s.removeLayer);
  const groupSelected = useEditorV2Store((s) => s.groupSelected);
  const ungroup = useEditorV2Store((s) => s.ungroup);

  if (!project) return null;
  const layers = project.layers;

  const onRowClick = (e: MouseEvent, id: string) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) select([id], true);
    else select([id]);
  };

  const groups = new Map<string, LayerDef[]>();
  layers.forEach((l) => {
    if (l.groupId) {
      if (!groups.has(l.groupId)) groups.set(l.groupId, []);
      groups.get(l.groupId)!.push(l);
    }
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm }}>
        <h3 style={{ ...sectionHeadingStyle, margin: 0 }}>Layers</h3>
        <button
          onClick={groupSelected}
          disabled={selectedIds.length < 2}
          style={{ fontSize: font.sm, background: 'none', border: `1px solid ${color.border}`, borderRadius: radius.sm, padding: '2px 8px', color: color.text, opacity: selectedIds.length < 2 ? 0.4 : 1 }}
        >
          Group
        </button>
      </div>
      <div style={{ display: 'grid', gap: 2 }}>
        {layers.map((l, i) => {
          const selected = selectedIds.includes(l.id);
          const visible = l.visible !== false;
          return (
            <div key={l.id}>
              {l.groupId && groups.get(l.groupId)?.[0]?.id === l.id && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: font.xs, opacity: 0.6, padding: '4px 8px' }}>
                  <span>Group</span>
                  <button onClick={() => ungroup(l.groupId!)} style={{ background: 'none', border: 0, color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>
                    Ungroup
                  </button>
                </div>
              )}
              <div
                onClick={(e) => onRowClick(e, l.id)}
                style={{ ...row, cursor: 'pointer', background: selected ? color.accentRing : 'transparent', marginLeft: l.groupId ? 12 : 0 }}
              >
                <button onClick={(e) => { e.stopPropagation(); toggleVisible(l.id); }} title="Show/hide" style={{ ...iconBtn, opacity: visible ? 0.9 : 0.35 }}>
                  {visible ? '👁' : '⨯'}
                </button>
                <button onClick={(e) => { e.stopPropagation(); toggleLock(l.id); }} title="Lock" style={{ ...iconBtn, opacity: l.locked ? 1 : 0.35 }}>
                  {l.locked ? '🔒' : '🔓'}
                </button>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.label}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setPlane(l.id, l.plane === 'device' ? 'popout' : 'device'); }}
                  title="Parent to device screen"
                  style={{ ...iconBtn, opacity: l.plane === 'device' ? 1 : 0.35 }}
                >
                  📱
                </button>
                <button onClick={(e) => { e.stopPropagation(); reorderLayer(l.id, i - 1); }} disabled={i === 0} title="Move up" style={{ ...iconBtn, opacity: i === 0 ? 0.25 : 0.85 }}>
                  ↑
                </button>
                <button onClick={(e) => { e.stopPropagation(); reorderLayer(l.id, i + 1); }} disabled={i === layers.length - 1} title="Move down" style={{ ...iconBtn, opacity: i === layers.length - 1 ? 0.25 : 0.85 }}>
                  ↓
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeLayer(l.id); }} title="Delete" style={{ ...iconBtn, color: color.danger }}>
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
