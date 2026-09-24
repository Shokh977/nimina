'use client';

import { useCallback, useEffect, useState } from 'react';

import { exportVideo } from '@/engine/export';
import { render } from '@/engine/render';
import { getRegressionFixtures, previewCanvasSize, type RegressionSample } from '@/dev/visualRegressionFixtures';

// Preview is a direct, uncompressed canvas readback — tight tolerance
// catches real regressions. Export goes through H.264, which is lossy by
// design, so it gets a looser one.
const PREVIEW_TOLERANCE_PAD = 0;
const EXPORT_TOLERANCE_PAD = 6;
const PREVIEW_SCALE = 0.5;

interface SampleResult {
  label: string;
  expected: [number, number, number];
  actual: [number, number, number];
  tolerance: number;
  pass: boolean;
}

interface FixtureResult {
  id: string;
  label: string;
  preview: SampleResult[];
  export: SampleResult[];
  error?: string;
}

function readPixel(canvas: HTMLCanvasElement, xFrac: number, yFrac: number): [number, number, number] {
  const readCanvas = document.createElement('canvas');
  readCanvas.width = canvas.width;
  readCanvas.height = canvas.height;
  const ctx = readCanvas.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0);
  const x = Math.round(xFrac * canvas.width);
  const y = Math.round(yFrac * canvas.height);
  const data = ctx.getImageData(x, y, 1, 1).data;
  return [data[0], data[1], data[2]];
}

function checkSample(sample: RegressionSample, actual: [number, number, number], tolerancePad: number): SampleResult {
  const tolerance = sample.tolerance + tolerancePad;
  const pass = actual.every((v, i) => Math.abs(v - sample.expected[i]) <= tolerance);
  return { label: sample.label, expected: sample.expected, actual, tolerance, pass };
}

async function decodeExportFrame(blob: Blob, atSeconds: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.src = url;
  video.muted = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('video failed to load'));
  });
  video.currentTime = atSeconds;
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
  });
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d')!.drawImage(video, 0, 0);
  URL.revokeObjectURL(url);
  return canvas;
}

/**
 * Standing visual-regression check (CLAUDE.md rule 7) — renders both
 * fixtures (src/dev/visualRegressionFixtures.ts) in preview and in a real
 * export, samples known pixel regions, and reports pass/fail against
 * expected values. Driven interactively via the button below, or headlessly
 * by scripts/visual-regression.mjs (`npm run visual-regression`), which
 * reads `window.__visualRegressionResults` after
 * `window.__runVisualRegression()` resolves.
 */
export default function VisualRegressionPage() {
  const [results, setResults] = useState<FixtureResult[] | null>(null);
  const [running, setRunning] = useState(false);

  const run = useCallback(async () => {
    setRunning(true);
    const fixtures = getRegressionFixtures();
    const out: FixtureResult[] = [];
    for (const fixture of fixtures) {
      try {
        const { project, assets } = fixture.build();

        // Preview: render at sampleAtT directly onto a canvas, read back.
        const { width, height } = previewCanvasSize(project, PREVIEW_SCALE);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        render(ctx, project, assets, fixture.sampleAtT, PREVIEW_SCALE);
        const preview = fixture.samples.map((s) => checkSample(s, readPixel(canvas, s.xFrac, s.yFrac), PREVIEW_TOLERANCE_PAD));

        // Export: same project, real export pipeline (WebCodecs, falling
        // back to MediaRecorder), decoded back from the resulting file —
        // exercises the exact color pipeline a user's download goes
        // through, not just the live preview.
        const exportResult = await exportVideo(project, assets, null, { resolution: '720p' }, new AbortController().signal);
        const frameCanvas = await decodeExportFrame(exportResult.blob, fixture.sampleAtT);
        const exportChecks = fixture.samples.map((s) => checkSample(s, readPixel(frameCanvas, s.xFrac, s.yFrac), EXPORT_TOLERANCE_PAD));

        out.push({ id: fixture.id, label: fixture.label, preview, export: exportChecks });
      } catch (err) {
        out.push({ id: fixture.id, label: fixture.label, preview: [], export: [], error: err instanceof Error ? err.message : String(err) });
      }
    }
    setResults(out);
    setRunning(false);
    const allPass = out.every((f) => !f.error && [...f.preview, ...f.export].every((s) => s.pass));
    (window as unknown as { __visualRegressionResults: { allPass: boolean; fixtures: FixtureResult[] } }).__visualRegressionResults = { allPass, fixtures: out };
  }, []);

  useEffect(() => {
    (window as unknown as { __runVisualRegression: () => Promise<void> }).__runVisualRegression = run;
  }, [run]);

  const renderSample = (s: SampleResult) => (
    <div key={s.label} style={{ fontSize: 12, color: s.pass ? '#7CF0FF' : '#ff8a8a', fontFamily: 'monospace' }}>
      {s.pass ? '✓' : '✗'} {s.label}: expected [{s.expected.join(',')}] ±{s.tolerance}, got [{s.actual.join(',')}]
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#0B0B10', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Visual regression check</h1>
      <p style={{ fontSize: 13, color: '#9BA1B0', margin: '0 0 16px', maxWidth: 640 }}>
        CLAUDE.md rule 7 — two fixtures (the classic multi-slide demo and the story-format demo), sampled in both preview and a real export. Run after any change touching
        src/engine/render.ts, src/engine/export/, or any drawing/overlay code.
      </p>
      <button onClick={run} disabled={running} style={{ border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 700, background: '#6D5BFF', color: '#fff', opacity: running ? 0.6 : 1 }}>
        {running ? 'Running… (exports take a few seconds each)' : 'Run check'}
      </button>
      {results && (
        <div style={{ marginTop: 20, display: 'grid', gap: 16 }}>
          {results.map((f) => (
            <div key={f.id} style={{ border: '1px solid #26262f', borderRadius: 10, padding: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{f.label}</div>
              {f.error ? (
                <div style={{ color: '#ff8a8a', fontSize: 12 }}>FAILED TO RUN: {f.error}</div>
              ) : (
                <>
                  <div style={{ fontSize: 11, opacity: 0.6, margin: '6px 0 2px' }}>Preview</div>
                  {f.preview.map(renderSample)}
                  <div style={{ fontSize: 11, opacity: 0.6, margin: '10px 0 2px' }}>Export</div>
                  {f.export.map(renderSample)}
                </>
              )}
            </div>
          ))}
          <div style={{ fontWeight: 800, fontSize: 14 }}>{results.every((f) => !f.error && [...f.preview, ...f.export].every((s) => s.pass)) ? '✓ ALL PASS' : '✗ FAILURES ABOVE'}</div>
        </div>
      )}
    </div>
  );
}
