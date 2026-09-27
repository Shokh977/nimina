"use client";

import { use, useEffect, useRef } from "react";

import { FCOLORS, MODELS, POSE_PRESETS } from "@/engine/constants";
import { screenBox } from "@/engine/devices";
import { render } from "@/engine/render";
import { createImageSlide } from "@/engine/slides";
import type {
  AssetMap,
  FrameColorId,
  ModelKey,
  PosePresetKey,
  Project,
} from "@/engine/types";
import { makeSample } from "@/dev/sampleProject";

/**
 * Dev-only page for the 3D pose feature's visual review: renders one
 * static frame per (device model × pose preset) directly via render(),
 * bypassing the editor UI entirely, as a single grid (rows = models,
 * columns = poses) so every combination can be checked side by side.
 *
 * Query params narrow the grid: `?pose=threeQL` shows one column,
 * `?models=island,notch` limits the rows, `?fcolor=graphite` overrides
 * every row's frame color, `?size=720` sets each canvas's width in px,
 * `?sample=fit` swaps the screenshot for a bordered test card drawn at each
 * model's own screen aspect (checks the screen quad's per-model fit).
 */
const ROW_COLORS: Record<ModelKey, FrameColorId> = {
  island: "graphite",
  notch: "titanium",
  punch: "rose",
  tablet: "silver",
  browser: "midnight",
  card: "graphite",
};

/** A test card drawn at exactly `model`'s own screen aspect ratio: a red
 * border, corner markers and a grid. If the screen quad is sized per model
 * and the image cover-fitted into it, the whole border shows edge to edge
 * with no crop on any model. */
function makeFitCard(model: ModelKey): HTMLCanvasElement {
  const m = MODELS[model];
  const sb = screenBox(1000 * m.ratio, 1000, model);
  const cv = document.createElement("canvas");
  cv.width = 800;
  cv.height = Math.round((800 * sb.h) / sb.w);
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#F4F4F6";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = "#C9CCD6";
  ctx.lineWidth = 2;
  for (let x = 0; x <= cv.width; x += 80) ctx.strokeRect(x, 0, 0, cv.height);
  for (let y = 0; y <= cv.height; y += 80) ctx.strokeRect(0, y, cv.width, 0);
  ctx.strokeStyle = "#E5213B";
  ctx.lineWidth = 24;
  ctx.strokeRect(12, 12, cv.width - 24, cv.height - 24);
  ctx.fillStyle = "#1F6FEB";
  const c = 90;
  [
    [0, 0],
    [cv.width - c, 0],
    [0, cv.height - c],
    [cv.width - c, cv.height - c],
  ].forEach(([x, y]) => ctx.fillRect(x, y, c, c));
  ctx.fillStyle = "#15171C";
  ctx.font = "700 64px Figtree, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(
    `${model} ${(sb.w / sb.h).toFixed(3)}`,
    cv.width / 2,
    cv.height / 2,
  );
  return cv;
}

function buildProject(
  model: ModelKey,
  fcolor: FrameColorId,
  pose: PosePresetKey,
  fitCard: boolean,
): { project: Project; assets: AssetMap } {
  const sample = fitCard ? makeFitCard(model) : makeSample("today");
  const assets: AssetMap = { today: sample };
  const preset = POSE_PRESETS[pose];
  const project: Project = {
    format: "9:16",
    preset: 0,
    colors: { a: "#3347FF", b: "#0C1662", text: "#FFFFFF", accent: "#FFD23F" },
    font: 0,
    model,
    fcolor,
    bgPattern: "glow",
    shapes: true,
    grain: false,
    vignette: false,
    storyBars: false,
    hlStyle: "marker",
    textPos: "top",
    textAnim: "rise",
    transition: "wipe",
    appName: "Tally",
    intro: { on: false, dur: 0, tagline: "", style: {} },
    iconAssetId: null,
    outro: { on: false, dur: 0, cta: "", button: "", small: "", style: {} },
    quality: "1080",
    music: null,
    volume: 0.8,
    ducking: true,
    motionSpeed: 100,
    scenes: [
      createImageSlide(1, "today", {
        headline: `${MODELS[model].label} — ${preset.label}`,
        sub: `${FCOLORS.find((c) => c.id === fcolor)?.label ?? fcolor}`,
        dur: 4,
        pose3d: {
          rx: preset.rx,
          ry: preset.ry,
          rz: preset.rz,
          distance: preset.distance,
          scale: preset.scale,
        },
        motion3d: "none",
      }),
    ],
  };
  return { project, assets };
}

function Check({
  model,
  fcolor,
  pose,
  size,
  fitCard,
}: {
  model: ModelKey;
  fcolor: FrameColorId;
  pose: PosePresetKey;
  size: number;
  fitCard: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = Math.round((size * 16) / 9);
    const { project, assets } = buildProject(model, fcolor, pose, fitCard);
    const ctx = canvas.getContext("2d");
    if (ctx) render(ctx, project, assets, 2, size / 1080);
  }, [model, fcolor, pose, size, fitCard]);
  return (
    <div className="flex flex-col items-center gap-1">
      <canvas ref={ref} className="rounded-lg bg-black" />
      <p className="text-xs text-neutral-400">
        {model} / {fcolor} / {pose}
      </p>
    </div>
  );
}

type Query = Record<string, string | string[] | undefined>;

export default function Pose3DCheckPage({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const q = use(searchParams);
  const str = (k: string) =>
    typeof q[k] === "string" ? (q[k] as string) : null;
  const models =
    str("models")
      ?.split(",")
      .filter((m): m is ModelKey => m in MODELS) ??
    (Object.keys(MODELS) as ModelKey[]);
  const poses =
    str("pose")
      ?.split(",")
      .filter((p): p is PosePresetKey => p in POSE_PRESETS) ??
    (Object.keys(POSE_PRESETS) as PosePresetKey[]);
  const filter = {
    models,
    poses,
    fcolor: str("fcolor") as FrameColorId | null,
    size: Number(str("size")) || 360,
    fitCard: str("sample") === "fit",
  };
  return (
    <main className="min-h-full bg-neutral-950 p-6 text-neutral-100">
      <h1 className="mb-4 text-lg font-semibold">
        3D pose visual check — models × poses
      </h1>
      {/* A single pose lays the models out side by side instead of one per row. */}
      <div
        className={
          filter.poses.length === 1 ? "flex gap-4" : "flex flex-col gap-4"
        }
        data-ready="1"
      >
        {filter.models.map((model) => (
          <div key={model} className="flex gap-4">
            {filter.poses.map((pose) => (
              <Check
                key={pose}
                model={model}
                fcolor={filter.fcolor ?? ROW_COLORS[model]}
                pose={pose}
                size={filter.size}
                fitCard={filter.fitCard}
              />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
