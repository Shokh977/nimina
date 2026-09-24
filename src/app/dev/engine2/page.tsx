'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

import { exportEngine2Video } from '@/engine2/export';
import { instantiateTemplate } from '@/engine2/player';
import { buildEngineV2Scene } from '@/engine2/sceneBuilder';
import { showcaseTemplate } from '@/engine2/templates/showcase';

const WIDTH = 480;
const HEIGHT = Math.round((WIDTH * 1920) / 1080);

/**
 * Engine v2 showcase: tilted phone on a mesh-gradient background, a chat
 * screenshot, three chat-bubble cutouts lifting out with bouncy springs and
 * parallax float, a heart burst, camera push-in with growing depth of
 * field, and a kinetic headline. See src/engine2/templates/showcase.ts for
 * the actual scene data.
 */
export default function EngineV2ShowcasePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(8);
  const tRef = useRef(0);
  const playingRef = useRef(true);
  const lastRef = useRef(0);
  const updateRef = useRef<((t: number) => void) | null>(null);
  const renderRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const project = instantiateTemplate(showcaseTemplate, { styleId: 'playful', paletteId: 'aurora', seed: 1 });
    const inst = buildEngineV2Scene(renderer, project, WIDTH, HEIGHT);
    updateRef.current = inst.update;
    renderRef.current = inst.render;
    setDuration(project.duration);

    let raf = 0;
    const loop = (now: number) => {
      if (playingRef.current) {
        const dt = (now - lastRef.current) / 1000;
        lastRef.current = now;
        let next = tRef.current + dt;
        if (next > project.duration) next = 0;
        tRef.current = next;
        setT(next);
      } else {
        lastRef.current = now;
      }
      inst.update(tRef.current);
      inst.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      inst.dispose();
    };
  }, []);

  const onScrub = (v: number) => {
    tRef.current = v;
    setT(v);
    updateRef.current?.(v);
    renderRef.current?.();
  };

  const togglePlay = () => {
    setPlaying((p) => {
      const next = !p;
      playingRef.current = next;
      if (next) lastRef.current = performance.now();
      return next;
    });
  };

  const [exportStatus, setExportStatus] = useState('');
  const [resolution, setResolution] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [motionBlur, setMotionBlur] = useState(false);
  const [exporting, setExporting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const startRef = useRef(0);

  const onExport = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    startRef.current = performance.now();
    setExporting(true);
    setExportStatus('Exporting… 0/0');
    try {
      const project = instantiateTemplate(showcaseTemplate, { styleId: 'playful', paletteId: 'aurora', seed: 1 });
      const res = await exportEngine2Video(project, null, { resolution, motionBlur, subframeCount: 6 }, controller.signal, (done, total) => {
        const elapsedS = (performance.now() - startRef.current) / 1000;
        const etaS = done > 0 ? (elapsedS / done) * (total - done) : 0;
        setExportStatus(`Exporting… ${done}/${total} · ETA ${etaS.toFixed(0)}s`);
      });
      const elapsed = ((performance.now() - startRef.current) / 1000).toFixed(1);
      setExportStatus(`Done: ${(res.sizeBytes / 1048576).toFixed(2)} MB, ${res.seconds.toFixed(1)}s video, took ${elapsed}s`);
      (window as unknown as { __exportBlob: Blob }).__exportBlob = res.blob;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setExportStatus('Export canceled.');
      } else {
        setExportStatus('Export failed: ' + (err instanceof Error ? err.message : String(err)));
      }
    } finally {
      abortRef.current = null;
      setExporting(false);
    }
  };

  const onCancelExport = () => {
    abortRef.current?.abort();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0B0B10', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, gap: 16, color: '#fff', fontFamily: 'system-ui, sans-serif' }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Engine v2 — Showcase</h1>
        <p style={{ fontSize: 13, color: '#9BA1B0', margin: '4px 0 0' }}>Three.js rendering, mesh-gradient background, cutout layers, bloom + DOF + grain.</p>
      </div>
      <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}>
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ display: 'block', background: '#000' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: WIDTH }}>
        <button
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          style={{ width: 40, height: 40, borderRadius: '50%', border: 0, background: '#fff', color: '#0B0B10', fontWeight: 700, flex: 'none' }}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <input type="range" min={0} max={duration} step={0.01} value={t} onChange={(e) => onScrub(Number(e.target.value))} style={{ flex: 1 }} />
        <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#9BA1B0', minWidth: 70, textAlign: 'right' }}>
          {t.toFixed(1)} / {duration.toFixed(1)}s
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: WIDTH, flexWrap: 'wrap' }}>
        <select
          value={resolution}
          onChange={(e) => setResolution(e.target.value as '720p' | '1080p' | '4k')}
          disabled={exporting}
          style={{ background: '#1A1A22', color: '#fff', border: '1px solid #33333f', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}
        >
          <option value="720p">720p</option>
          <option value="1080p">1080p</option>
          <option value="4k">4K</option>
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9BA1B0' }}>
          <input type="checkbox" checked={motionBlur} onChange={(e) => setMotionBlur(e.target.checked)} disabled={exporting} />
          Motion blur (6 subframes)
        </label>
        <button onClick={onExport} disabled={exporting} style={{ border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 700, background: '#6D5BFF', color: '#fff', opacity: exporting ? 0.6 : 1 }}>
          Export test
        </button>
        {exporting && (
          <button onClick={onCancelExport} style={{ border: 0, borderRadius: 8, padding: '8px 14px', fontWeight: 700, background: '#3a2222', color: '#ff9b9b' }}>
            Cancel
          </button>
        )}
        <span style={{ fontSize: 12, color: '#9BA1B0' }}>{exportStatus}</span>
      </div>
    </div>
  );
}
