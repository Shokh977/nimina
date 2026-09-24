'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

import { buildEngineV2Scene } from '@/engine2/sceneBuilder';
import type { ImageAsset, SceneProjectV2 } from '@/engine2/types';

const W = 200;
const H = Math.round((W * 1920) / 1080);

/** One small looping live preview of a generated SceneProjectV2 — used by
 * the /dev/recipes remix gallery to show variations side by side. */
export default function RecipePreview({ project, assets }: { project: SceneProjectV2; assets: Record<string, ImageAsset> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    const inst = buildEngineV2Scene(renderer, project, W, H, { assets });
    let raf = 0;
    const start = performance.now();
    const loop = () => {
      const t = ((performance.now() - start) / 1000) % project.duration;
      inst.update(t);
      inst.render();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      inst.dispose();
    };
  }, [project, assets]);

  return <canvas ref={canvasRef} width={W} height={H} style={{ display: 'block', borderRadius: 8, background: '#000' }} />;
}
