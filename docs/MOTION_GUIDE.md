# Motion Guide

The design and motion standard every animation in this product must follow —
in Engine v2 (`src/engine-v2/`), in the editor UI, and anywhere else motion
appears. Reference implementation: `legacy/motion-lab-download.html`
(springs in `spr()`/`tr()`, `STYLES`, `PALS`, and the three reference
templates). `/dev/compare` plays that reference against Engine v2's output
side by side so drift from this guide is visible immediately.

## Springs

The default for all movement — no linear or plain cubic easing, except
continuous scroll/rotation (a spinning loading indicator, a scrolling list
mid-drag).

| Preset  | Stiffness (k) | Damping (c) | Mass |
| ------- | ------------- | ----------- | ---- |
| gentle  | 170           | 26          | 1    |
| bouncy  | 300           | 18          | 1    |
| snappy  | 420           | 32          | 1    |

(Engine v2 also carries `soft`, `wobbly`, `punch` and `crisp` as further
presets — see `src/engine-v2/spring.ts` — but gentle/bouncy/snappy are the
three named here because they're the ones every enter/exit falls back to.)

Every **enter** animation uses a spring with slight overshoot. Every **exit**
is faster (200–300ms) and does not overshoot — exits read as a clean
dismissal, not a bounce.

## Timing

- **Stagger** sibling elements by 40–70ms. Never animate a group all at once
  — a list, a row of chips, a set of particles all move in sequence, not in
  unison.
- **Overlap**: the next action starts when the previous one is ~70% done.
  Nothing waits for a full stop before the next thing begins.
- **Anticipation**: before a pop or tap, scale down 3–6% for 80–120ms. The
  squash-before-the-jump — it's what makes a tap feel like it landed.
- **Nothing is fully static**: every resting element has an idle float
  (1–3px, 3–5s period, randomized phase per element). A frame with zero
  motion in it is a bug, not a rest state.
- **One focal point at a time**: dim or blur everything else during a hero
  moment.
- A **hero moment** every 3–4 seconds. Stories run 10–20 seconds total.

## Depth (3 planes)

| Plane                | Parallax | Notes                                              |
| --------------------- | -------- | --------------------------------------------------- |
| Background            | 0.3      | Depth-of-field blur 6–12px when the camera zooms in |
| Device                | 1.0      | The phone/screen itself — the reference plane       |
| Pop-out foreground     | 1.4      | Lifted layers — see "Lift layer" below               |

Shadows grow with elevation, never fixed:

- blur = `8 + z*40` px
- y-offset = `4 + z*20` px
- opacity: 0.12–0.28
- tinted with the background color — **never pure black**

Popped-out layers lift toward the camera with a 3–8° tilt and a stronger
shadow than their resting state.

### Lift layer

A layer that "pops out" of the screen is a sibling of the phone screen,
positioned using the *exact same screen coordinates* the element has at
rest — so it visibly lifts out of the screen from precisely where it sits,
in true 3D (z-translation + tilt), while the original dims underneath it.
It is not a separate, differently-positioned element that merely appears
near the same spot — the coordinate system must match exactly, or the lift
reads as a swap instead of a lift.

## Camera

- At most **one major camera move per ~2 seconds**. Always spring or
  ease-in-out, never linear.
- A subtle **continuous drift** (0.5–1% scale) between major moves — the
  camera is never perfectly still, even when nothing major is happening.
- A camera move **leads** the viewer's eye to the next focal point slightly
  *before* the action happens there, not after.

## Color

Build the palette from the app's own screenshots — dominant color + accent
— plus one complementary color chosen against them. Backgrounds are mesh or
multi-stop gradients, never flat. Avoid pure black and pure white
backgrounds. Add 3–5% grain.

## Typography

Kinetic text reveals **line by line or word by word from inside a clip
mask** (sliding up into view) — never a plain fade. In vertical video: max
~5–6 words per line, headline sized to 7–9% of frame width, bold weight,
tight letter-spacing (-1% to -2%).

## Sound

Every visible motion event has a sound (see `src/engine/audio/` for the
existing procedural-SFX system this extends to). Pops and cuts land on
music beats when snap-to-beat is on.

## Export quality

Motion blur on export: render 6 subframes per frame and average them.
Preview playback can skip this — it's an export-time-only cost.

## Anti-patterns

Things that mean a scene isn't following this guide:

- **Flat screenshot panning** — moving a screenshot without any depth, lift,
  or camera response is not motion design, it's a slideshow.
- **Everything fading in at once** — no stagger, no sequencing, every
  element arriving in the same beat.
- **Identical timings** — every enter/exit using the same duration and
  curve regardless of what it is or how important it is.
- **Linear motion** — anything that isn't scroll/rotation moving at a
  constant rate instead of on a spring.
- **Dead static frames** — any moment where literally nothing is drifting,
  floating, or breathing.
- **Cluttered multiple focal points** — more than one thing competing for
  attention at once, instead of one hero moment with everything else dimmed
  or blurred.
