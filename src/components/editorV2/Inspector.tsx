'use client';

import { useState } from 'react';

import { useEditorV2Store } from '@/store/editorV2Store';
import CurveEditor from './CurveEditor';
import LayerInspector from './LayerInspector';
import ProjectPanel from './ProjectPanel';
import { color, font } from './tokens';

type Tab = 'project' | 'layer' | 'curve';

/**
 * RIGHT zone (layout rebuild) — a single inspector whose content follows
 * selection: nothing selected → Project, a layer selected → Layer, a
 * keyframe selected → Curve. The tab row is still clickable (not just a
 * read-only indicator) so switching *to* it manually — e.g. peeking at
 * Project settings without losing the current layer selection — works
 * too; it just resets to auto-follow the next time selection changes,
 * which is what makes the auto-behavior actually useful instead of
 * fighting a manual override forever.
 */
export default function Inspector() {
  const selectedIds = useEditorV2Store((s) => s.selectedIds);
  const selectedKeyframe = useEditorV2Store((s) => s.selectedKeyframe);

  const autoTab: Tab = selectedKeyframe ? 'curve' : selectedIds.length === 1 ? 'layer' : 'project';
  const selectionKey = selectedKeyframe ? `kf:${selectedKeyframe.layerId}:${selectedKeyframe.axis}:${selectedKeyframe.index}` : selectedIds.join(',');

  const [tab, setTab] = useState<Tab>(autoTab);
  // React's own recommended "reset state when a prop changes" pattern
  // (not an effect — setting state directly in the render body, gated so
  // it only fires the one render selection actually changed on, is the
  // documented way to do this without an extra effect-triggered render
  // pass). See the component doc comment for why a manual tab click is
  // allowed to stick *between* selection changes rather than being
  // fought every render.
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setTab(autoTab);
  }

  const tabs: Array<{ id: Tab; label: string; disabled?: boolean }> = [
    { id: 'project', label: 'Project' },
    { id: 'layer', label: 'Layer', disabled: selectedIds.length !== 1 },
    { id: 'curve', label: 'Curve', disabled: !selectedKeyframe },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${color.border}`, flex: 'none' }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            disabled={t.disabled}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: '10px 8px',
              fontSize: font.md,
              fontWeight: 700,
              background: 'none',
              border: 0,
              borderBottom: tab === t.id ? `2px solid ${color.accent}` : '2px solid transparent',
              color: tab === t.id ? color.text : t.disabled ? color.textMuted : color.textSecondary,
              cursor: t.disabled ? 'default' : 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 16 }}>
        {tab === 'project' && <ProjectPanel />}
        {tab === 'layer' && selectedIds.length === 1 && <LayerInspector layerId={selectedIds[0]} />}
        {tab === 'curve' && <CurveEditor />}
      </div>
    </div>
  );
}
