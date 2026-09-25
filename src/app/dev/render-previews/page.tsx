'use client';

import { useState } from 'react';

import { exportVideo } from '@/engine/export';
import { TEMPLATES } from '@/engine/templates';

/**
 * Renders every template's short-cut variant in 9:16 and 16:9, base64-
 * encodes the results onto `window.__renderedPreviews`, for
 * scripts/render-template-previews.mjs to pick up and upload to the
 * `template-previews` Storage bucket. Permanent (not a one-off QA page,
 * unlike the Batch 1/2/3 template-check pages) — this is the actual
 * mechanism behind re-rendering a preview whenever a template changes.
 * Generic over `TEMPLATES`: a template with no `buildSampleAssets` (the
 * original starter set) is skipped, not an error — see TemplateDef's doc
 * comment.
 */
export default function RenderPreviewsPage() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const lines: string[] = [];
    const results: Record<string, string> = {};
    for (const def of TEMPLATES) {
      if (!def.buildSampleAssets) {
        lines.push(`[skip] ${def.id}: no buildSampleAssets`);
        setLog([...lines]);
        continue;
      }
      const assets = def.buildSampleAssets();
      for (const [tag, fmt] of [
        ['9x16', '9:16'],
        ['16x9', '16:9'],
      ] as const) {
        try {
          const { project } = def.build({ variant: 'short' });
          const result = await exportVideo({ ...project, format: fmt }, assets, null, { resolution: '1080p' }, new AbortController().signal);
          const buf = await result.blob.arrayBuffer();
          let binary = '';
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          results[`${def.id}-${tag}`] = btoa(binary);
          lines.push(`[ok] ${def.id} ${tag}: ${(result.sizeBytes / 1048576).toFixed(2)}MB, ${result.seconds.toFixed(1)}s`);
        } catch (err) {
          lines.push(`[fail] ${def.id} ${tag}: ${err instanceof Error ? err.message : String(err)}`);
        }
        setLog([...lines]);
      }
    }
    (window as unknown as { __renderedPreviews: Record<string, string> }).__renderedPreviews = results;
    (window as unknown as { __renderPreviewsDone: boolean }).__renderPreviewsDone = true;
    setRunning(false);
  };

  return (
    <div style={{ background: '#0B0B10', color: '#fff', padding: 20, fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
      <h1 style={{ fontSize: 16 }}>Render template previews</h1>
      <p style={{ fontSize: 12, color: '#9BA1B0', marginBottom: 12 }}>
        Driven by scripts/render-template-previews.mjs — not meant to be used by hand, though it works standalone too.
      </p>
      <button onClick={run} disabled={running} style={{ border: 0, borderRadius: 6, padding: '6px 12px', background: '#6D5BFF', color: '#fff', marginBottom: 12 }}>
        {running ? 'Rendering…' : 'Render all previews'}
      </button>
      <pre style={{ fontFamily: 'monospace' }}>{log.join('\n')}</pre>
    </div>
  );
}
