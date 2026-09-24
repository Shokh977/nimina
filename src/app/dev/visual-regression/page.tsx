'use client';

import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

import { exportEngine2Video } from '@/engine2/export';
import { buildEngineV2Scene } from '@/engine2/sceneBuilder';
import { getRegressionFixtures, type RegressionSample } from '@/engine2/visualRegressionFixtures';
import '@/engine2/registerAllContent';

const WIDTH = 480;
const HEIGHT = Math.round((WIDTH * 1920) / 1080);
// Preview is a direct, uncompressed GPU readback — tight tolerance catches
// real regressions. Export goes through H.264, which is lossy by design
// (measured ~1 point of rounding even on a fully correct pipeline — see
// CLAUDE.md rule 7's before/after numbers), so it gets a looser one.
const PREVIEW_TOLERANCE_PAD = 0;
const EXPORT_TOLERANCE_PAD = 6;

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

function checkSample(sample: RegressionSample, actual: [number, number, number], toleragePad: number): SampleResult {
  const tolerance = sample.tolerance + toleragePad;
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
 * fixtures (visualRegressionFixtures.ts) in preview and in a real (short,
 * duration-trimmed for speed) export, samples known pixel regions, and
 * reports pass/fail against expected values. Driven interactively via the
 * button below, or headlessly by scripts/visual-regression.mjs (`npm run
 * visual-regression`), which reads `window.__visualRegressionResults`
 * after `window.__runVisualRegression()` resolves.
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

        // Preview: build, render at sampleAtT, read the canvas back directly.
        const canvas = document.createElement('canvas');
        const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
        const inst = buildEngineV2Scene(renderer, project, WIDTH, HEIGHT, { assets });
        await inst.ready;
        inst.update(fixture.sampleAtT);
        await inst.awaitFrame(fixture.sampleAtT);
        inst.render();
        const preview = fixture.samples.map((s) => checkSample(s, readPixel(canvas, s.xFrac, s.yFrac), PREVIEW_TOLERANCE_PAD));
        inst.dispose();

        // Export: same project, duration trimmed to just past sampleAtT so
        // the export stays fast (a handful of frames, not the full
        // template length) while still exercising the real export pipeline.
        const exportProject = { ...project, duration: fixture.sampleAtT + 0.1 };
        const exportResult = await exportEngine2Video(exportProject, null, { resolution: '720p', assets }, new AbortController().signal);
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
        CLAUDE.md rule 7 — two fixtures (a dark, hand-tuned palette and a real near-white screenshot on a light background), sampled in both preview and a real export. Run after any
        change touching camera.ts, sceneBuilder.ts, grain.ts, watermark.ts, or any material/shader/compositing code.
      </p>
      <button onClick={run} disabled={running} style={{ border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 700, background: '#6D5BFF', color: '#fff', opacity: running ? 0.6 : 1 }}>
        {running ? 'Running… (exports take ~15-30s each)' : 'Run check'}
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
          <div style={{ fontWeight: 800, fontSize: 14 }}>
            {results.every((f) => !f.error && [...f.preview, ...f.export].every((s) => s.pass)) ? '✓ ALL PASS' : '✗ FAILURES ABOVE'}
          </div>
        </div>
      )}
    </div>
  );
}
