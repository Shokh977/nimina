'use client';

import { useEffect, useRef } from 'react';

import { FCOLORS, MODELS, POSE_PRESETS } from '@/engine/constants';
import { render } from '@/engine/render';
import { createImageSlide } from '@/engine/slides';
import type { AssetMap, FrameColorId, ModelKey, PosePresetKey, Project } from '@/engine/types';
import { makeSample } from '@/dev/sampleProject';

/**
 * TEMPORARY dev-only page for the 3D pose feature's manual visual-review
 * checkpoint (see the 3D device pose plan, "steps 1-3, then stop for
 * review"). Not part of the approved plan's file list — delete after the
 * screenshots it's for have been captured and reviewed.
 *
 * Renders one static frame per (device model, color, pose preset)
 * combination directly via render(), bypassing the editor UI entirely, so
 * every preset can be checked at a glance without needing auth or manual
 * clicking through SceneCard for each one.
 */
const CHECKS: Array<{ model: ModelKey; fcolor: FrameColorId; pose: PosePresetKey }> = [
  ...(Object.keys(POSE_PRESETS) as PosePresetKey[]).map((pose) => ({ model: 'island' as ModelKey, fcolor: 'graphite' as FrameColorId, pose })),
  ...(Object.keys(POSE_PRESETS) as PosePresetKey[]).map((pose) => ({ model: 'tablet' as ModelKey, fcolor: 'silver' as FrameColorId, pose })),
  { model: 'punch', fcolor: 'rose', pose: 'hero' },
  { model: 'browser', fcolor: 'midnight', pose: 'threeQL' },
  { model: 'notch', fcolor: 'titanium', pose: 'floating' },
  { model: 'notch', fcolor: 'graphite', pose: 'front' },
  { model: 'card', fcolor: 'graphite', pose: 'hero' },
];

function buildProject(model: ModelKey, fcolor: FrameColorId, pose: PosePresetKey): { project: Project; assets: AssetMap } {
  const sample = makeSample('today');
  const assets: AssetMap = { today: sample };
  const preset = POSE_PRESETS[pose];
  const project: Project = {
    format: '9:16',
    preset: 0,
    colors: { a: '#3347FF', b: '#0C1662', text: '#FFFFFF', accent: '#FFD23F' },
    font: 0,
    model,
    fcolor,
    bgPattern: 'glow',
    shapes: true,
    grain: false,
    vignette: false,
    storyBars: false,
    hlStyle: 'marker',
    textPos: 'top',
    textAnim: 'rise',
    transition: 'wipe',
    appName: 'Tally',
    intro: { on: false, dur: 0, tagline: '', style: {} },
    iconAssetId: null,
    outro: { on: false, dur: 0, cta: '', button: '', small: '', style: {} },
    quality: '1080',
    music: null,
    volume: 0.8,
    ducking: true,
    motionSpeed: 100,
    scenes: [
      createImageSlide(1, 'today', {
        headline: `${MODELS[model].label} — ${preset.label}`,
        sub: `${FCOLORS.find((c) => c.id === fcolor)?.label ?? fcolor}`,
        dur: 4,
        pose3d: { rx: preset.rx, ry: preset.ry, rz: preset.rz, distance: preset.distance, scale: preset.scale },
        motion3d: 'none',
      }),
    ],
  };
  return { project, assets };
}

function Check({ model, fcolor, pose }: { model: ModelKey; fcolor: FrameColorId; pose: PosePresetKey }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = 480;
    canvas.height = 853;
    const { project, assets } = buildProject(model, fcolor, pose);
    const ctx = canvas.getContext('2d');
    if (ctx) render(ctx, project, assets, 2, 480 / 1080);
  }, [model, fcolor, pose]);
  return (
    <div className="flex flex-col items-center gap-1">
      <canvas ref={ref} className="rounded-lg bg-black" />
      <p className="text-xs text-neutral-400">
        {model} / {fcolor} / {pose}
      </p>
    </div>
  );
}

export default function Pose3DCheckPage() {
  return (
    <main className="min-h-full flex-wrap gap-6 bg-neutral-950 p-8 text-neutral-100">
      <h1 className="mb-6 text-lg font-semibold">3D pose visual check (temporary)</h1>
      <div className="flex flex-wrap gap-6">
        {CHECKS.map((c, i) => (
          <Check key={i} {...c} />
        ))}
      </div>
    </main>
  );
}
