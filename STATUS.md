# Engine v2 — status at pause (2026-09-24)

Work on Engine v2 / `/editor2` is paused. The classic engine (`src/engine/`,
`/editor`) is the shipping product going forward — see `main`. This branch
(`engine-v2-wip`) preserves the Engine v2 prototype exactly as it stood when
work stopped, for a possible return later. Nothing was deleted to make this
branch; it's a straight continuation of the shared history.

## What Engine v2 was

A from-scratch, pure-TypeScript, Three.js/WebGL rendering engine
(`src/engine2/`) meant to eventually replace the classic canvas-2D engine —
real 3D camera/depth/lighting instead of 2D transforms, template-driven
scenes (`src/engine2/templates/`: reactions, checkout, insights, showcase),
a content-recipe system for procedurally-drawn UI (chat bubbles, cards,
stat panels, CTAs) so demos don't need real screenshots, selective
bloom/tone-mapping/grain/vignette/DOF post-processing, and a parallel
three-zone editor shell (`src/components/editorV2/`, `/editor2`) with its
own Zustand store (`src/store/editorV2Store.ts`) and Supabase persistence
(`src/lib/engine2Projects.ts`, `src/lib/supabase/projectsV2.ts`,
`supabase/migrations/0012_engine_v2_projects.sql`).

## What works

- Core render pipeline: selective bloom (particles/CTA/headline glow,
  surfaces stay crisp), selective tone-mapping exemption (screenshots/UI
  surfaces render at accurate, non-ACES-compressed color), grain, vignette,
  depth-of-field tied to camera zoom/rack-focus — all verified pixel-level
  against a standing regression harness (`npm run visual-regression`,
  `src/app/dev/visual-regression/page.tsx`,
  `src/engine2/visualRegressionFixtures.ts`,
  `scripts/visual-regression.mjs`) with two fixtures (dark hand-tuned
  palette, real near-white screenshot), each checked in both preview and a
  real export.
- Spring-based motion system (`src/engine2/evaluate.ts`, styles), camera
  rig with idle drift/push-in/rack-focus, particle bursts (hearts, confetti,
  sparkles, stars, coins — `src/engine2/particles.ts`), headline kinetic
  text reveal with 3 highlight styles.
- All four templates (reactions, checkout, insights, showcase) render with
  crisp UI surfaces and visibly glowing accents/particles/CTAs, verified
  directly against `legacy/motion-lab-download.html` frame-by-frame.
- Three-zone editor layout (`EditorV2Shell.tsx`): layer tree, canvas +
  transport + timeline, tabbed inspector (Project/Layer/Curve) that
  auto-follows selection. Grain/bloom/vignette exposed as project-level
  sliders.
- Export pipeline (`src/engine2/export.ts`) at 720p/1080p/4K with optional
  motion-blur (GPU accumulation across subframes).

## What's broken (known, not yet fixed)

1. **Timeline drag lag** — scrubbing/dragging in `TimelineV2` lags several
   seconds behind actual playhead position. Not root-caused. Suspect: the
   per-frame `update(t)` + `render()` cost on drag is too high relative to
   pointer-move event frequency, or state updates aren't batched/throttled
   for drag specifically (only for the RAF playback loop). Needs profiling.
2. **Device frames don't apply to `ui-element` content** — a layer whose
   content is a procedural `ui-element` recipe (chat bubble, card, etc.)
   doesn't pick up a device-frame override the way a `screenshot` layer
   does. Not root-caused; likely `buildDeviceFrameMesh`/the frame-override
   logic in `sceneBuilder.ts` only wires up for `content.sourceSlotId`
   (real image sources) the same way `buildCutoutMesh` does, and was never
   extended to procedural recipe content.
3. **Washed-out template colors** — reported before this session's bloom
   work; may be *partially* explained by the bloom/tone-mapping bugs fixed
   this session (see below), but was not re-verified against the current
   state before pausing. Needs a fresh look once/if this branch is resumed.
4. **Flat 2D card flips, no real geometry** — card-flip transitions
   (`backContent`/back-face meshes in `sceneBuilder.ts`) render as a flat
   opacity-crossfade-style flip rather than genuine 3D rotation with
   perspective/foreshortening. The back-face mesh exists and is positioned
   (`backMesh.rotation.y = Math.PI`), but the *animation* driving the flip
   doesn't appear to use real Y-rotation over time the way the geometry
   would support — needs a look at whatever evaluates the flip transform.

## What was in progress when paused

Mid-session work fixing three real, verified rendering bugs, all fixed and
committed in this branch's history:

1. **Bloom/tone-mapping applied to whole UI surfaces**, not just
   light-emitting accents — chat bubbles/cards/text were glowing and
   losing legibility. Fixed by extending the existing screenshot-only
   surface exclusion (`markAsSurfaceContent`) to `ui-element` and `shape`
   content, with an allowlist (`CTA_LIKE_RECIPES`) for the one genuinely
   accent-colored exception (`checkout-pay`, which fills with `palette.ui`
   rather than the near-white `palette.ink` every other CTA recipe uses).
2. **Bloom threshold (0.94) never retuned after the exclusion landed** —
   with surfaces hard-excluded regardless of threshold, 0.94 meant only
   literally-white content (headline text, white confetti) ever bloomed;
   saturated accent colors (`palette.ui` luminance ~0.42, a success green
   ~0.55) never crossed it and had zero glow. Lowered to 0.5 — see
   `src/engine2/camera.ts`'s `bloomOpts` doc comment for the full
   before/after reasoning and measurements.
3. **Tone-map-exemption overlay silently erased anything drawn in front of
   an excluded surface** — a real, subtle bug: the overlay that restores
   accurate (non-ACES-compressed) color to surfaces is a flat, depth-blind
   2D alpha composite, so any particle/CTA/headline occupying the same
   screen pixel as a surface behind it got overwritten. Caught via the
   heart-burst particles in the `reactions` template rendering completely
   invisible once the fix in (1) widened how much surface area could
   collide with them. Fixed with a "non-surface coverage mask" — a third,
   cheap render pass that hides every surface mesh (**and the background
   plane**, which otherwise floods the mask once things in front of it are
   hidden — see `background.ts`'s `isBackgroundPlane` flag) so only
   genuine foreground accent content remains, and protects those pixels
   from the surface overlay. Verified: `npm run visual-regression` passes
   (both fixtures, preview + export), all four templates re-checked.

**Not yet done** when the pivot happened:
- A third visual-regression fixture (a bright `ui-element` on a template
  background) was requested but not added.
- `/dev/compare` (Motion Lab reference in an iframe next to the Engine v2
  render, shared scrubber, 0.25x speed) — referenced in the old CLAUDE.md
  rule 6 as if it already existed; it didn't. Never built.
- A full audit of CLAUDE.md for other documented-but-nonexistent claims —
  not started.
- The dev scratch template-switch on `src/app/dev/engine2/page.tsx` was
  reverted to its canonical `showcaseTemplate`-only state before pausing,
  so that file is clean.

## If this branch is resumed

Start by re-running `npm run visual-regression` and re-checking all four
templates against `legacy/motion-lab-download.html` — confirm nothing
drifted, then work the "what's broken" list above roughly in the order
given (timeline lag and device-frame-on-ui-element are probably the two
most user-visible).
