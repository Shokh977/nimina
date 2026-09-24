/**
 * Camera rig: a real perspective camera (so layer depth/tilt/lift is
 * genuine 3D, not a fake) plus post-processing — BokehPass depth-of-field
 * (sharp at rest, progressively blurred as the camera zooms in, per
 * docs/MOTION_GUIDE.md), UnrealBloomPass for glow highlights, and FilmPass
 * for grain (3-5% per the guide). World units == the reference's CSS
 * logical pixels (1080x1920 stage), so a template's layer positions can be
 * authored in the same numbers the reference uses.
 */
import * as THREE from 'three';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import { evaluateProperty } from './evaluate';
import { ScaledGrainPass } from './grain';
import type { MotionStyle } from './styles';
import { constTrack, type CameraLayerDef, type PropertyTrack } from './types';
import { VignettePass } from './vignette';

/** Output aspect ratio (Tier 1, item 1: "a project-level format of 9:16,
 * 1:1 and 16:9"). Every template still authors content in the fixed
 * 1080x1920 *design space* below regardless of format — sceneBuilder.ts
 * fits that design into whichever format's actual frame by camera
 * distance (STAGE_H below) + a uniform content-scale wrapper, rather than
 * every template needing its own per-format layout code. See
 * sceneBuilder.ts's `contentRoot` for the other half of this. */
export type EngineFormat = '9:16' | '1:1' | '16:9';
export const FORMAT_STAGE_DIMS: Record<EngineFormat, { w: number; h: number }> = {
  '9:16': { w: 1080, h: 1920 },
  '1:1': { w: 1080, h: 1080 },
  '16:9': { w: 1920, h: 1080 },
};
export const DEFAULT_FORMAT: EngineFormat = '9:16';

/** The fixed design space every template's build() authors layer positions
 * in — unrelated to the *output* format above. `STAGE_W`/`STAGE_H` (the
 * pre-Tier-1 names) keep meaning exactly what they always meant: the 9:16
 * numbers, still used as the design-space reference by every template,
 * device mockup, and cutout source-texture size. */
export const STAGE_W = FORMAT_STAGE_DIMS['9:16'].w;
export const STAGE_H = FORMAT_STAGE_DIMS['9:16'].h;
/** Vertical FOV (degrees) — narrow-ish, like a real telephoto promo shot,
 * so perspective distortion at the frame edges stays gentle. */
export const FOV = 30;

/**
 * Render-regression fix: a THREE.Layers bit (in addition to the default
 * layer 0 every object already belongs to) for content that must render
 * crisp and bloom-free — real screenshots, device frames, and cutouts of
 * them (sceneBuilder.ts tags these). UnrealBloomPass previously ran once
 * over the *entire* composited scene: fine for the "genuinely bright
 * highlights" MOTION_GUIDE.md calls for (particles, accent glints,
 * headline text), but a real screenshot's background can be a large,
 * near-white, arbitrary-content area — nothing like a small highlight —
 * and bloom's response scales with both brightness *and* contiguous
 * bright area, so it washed the whole device out in a glowing haze and
 * reduced the on-screen text to near-illegibility. The fix (createCameraRig
 * below) is selective bloom: a second, offscreen composer renders the
 * scene with this layer's objects hidden from its camera (so they never
 * become a bloom *source*), and only that glow texture — never the
 * screenshot's own pixels — gets added back into the main, full-detail
 * render. Every object not on this layer (headline, particles, CTA,
 * stickers, ui-element cards) blooms exactly as it always did. */
export const NO_BLOOM_LAYER = 1;
/** Camera distance along +Z that makes a given stage height fill the frame
 * at zoom=1 — derived from FOV so the two always agree if FOV changes.
 * Takes the *output format's* stage height (not always STAGE_H above) so
 * the camera genuinely frames the requested aspect ratio instead of always
 * framing a 1920-tall shot and letting width crop/pad around it. */
function cameraZFor(stageH: number): number {
  return stageH / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
}

// Scratch objects reused every update() call (set-then-immediately-consumed
// within one synchronous call, never retained) — avoids a per-frame
// allocation for the rotation composition below.
const EXTRA_ROTATION_EULER = new THREE.Euler();
const EXTRA_ROTATION_QUAT = new THREE.Quaternion();

/** Builds a full CameraLayerDef from the old flat shape (zoom/x/y/rx/ry) —
 * every existing template's `build()` only needs to wrap its camera object
 * literal in this, unchanged otherwise. `target` defaults to the *same*
 * PropertyTrack objects as `x`/`y` (shared by reference, not copied) so the
 * camera looks straight ahead as it pans, matching the fixed behavior
 * camera.ts always had before `target` was a separate concept. */
export function buildCameraTrack(input: {
  zoom?: PropertyTrack;
  x?: PropertyTrack;
  y?: PropertyTrack;
  z?: PropertyTrack;
  rx?: PropertyTrack;
  ry?: PropertyTrack;
  rz?: PropertyTrack;
  fov?: PropertyTrack;
  target?: { x: PropertyTrack; y: PropertyTrack; z: PropertyTrack };
  drift?: boolean;
}): CameraLayerDef {
  const x = input.x ?? constTrack(0);
  const y = input.y ?? constTrack(0);
  return {
    position: { x, y, z: input.z ?? constTrack(0) },
    target: input.target ?? { x, y, z: constTrack(0) },
    rotation: { rx: input.rx ?? constTrack(0), ry: input.ry ?? constTrack(0), rz: input.rz ?? constTrack(0) },
    zoom: input.zoom ?? constTrack(1),
    fov: input.fov ?? constTrack(FOV),
    drift: input.drift ?? true,
  };
}

export interface CameraRig {
  camera: THREE.PerspectiveCamera;
  composer: EffectComposer;
  setSize(w: number, h: number): void;
  /** Latency fix: a format switch changes the world-space stage height
   * (FORMAT_STAGE_DIMS[format].h) the camera frames — this updates the
   * distance/focus derived from it in place, no renderer/composer/pass
   * recreation. Caller must also call setSize() with the new format's
   * pixel dimensions (a separate concern: output resolution vs. what
   * world-space extent that resolution frames). */
  setStageH(h: number): void;
  /** Applies a resolved CameraLayerDef at time t — position/target/
   * rotation/zoom/fov plus DOF blur derived from zoom (MOTION_GUIDE: blur
   * grows with zoom), plus the track's own toggleable idle drift
   * (MOTION_GUIDE: "subtle continuous drift (0.5-1% scale) between moves"
   * — never perfectly still, unless a template opts out). */
  update(t: number, track: CameraLayerDef, style: MotionStyle): { zoom: number; x: number; y: number; ry: number };
  render(): void;
  dispose(): void;
  /** Tier 2 item 14 — project-level post-process sliders, callable any
   * time (not just at construction) so a slider drag updates the live
   * preview immediately. */
  setGrainIntensity(v: number): void;
  setBloomStrength(v: number): void;
  setVignetteIntensity(v: number): void;
}

export interface CameraRigOptions {
  bloom?: { strength: number; radius: number; threshold: number };
  grainIntensity?: number;
  /** Tier 2 item 14 — 0-1, defaults to 0 (no vignette), matching every
   * project/template that predates this field. */
  vignetteIntensity?: number;
  /** The *output format's* stage height (FORMAT_STAGE_DIMS[format].h) —
   * defaults to the 9:16 design height for any caller that hasn't been
   * updated for multi-format (keeps this an additive change). Drives
   * camera distance (so the format's actual aspect fills the frame, not
   * always a 9:16 framing) and grain/DOF pixel scaling. */
  stageH?: number;
}

export function createCameraRig(renderer: THREE.WebGLRenderer, scene: THREE.Scene, width: number, height: number, opts: CameraRigOptions = {}): CameraRig {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  let stageH = opts.stageH ?? STAGE_H;
  let cameraZ = cameraZFor(stageH);

  const camera = new THREE.PerspectiveCamera(FOV, width / height, 10, 8000);
  camera.position.set(0, 0, cameraZ);

  // Selective bloom (see NO_BLOOM_LAYER's doc comment): a separate,
  // offscreen composer that renders the same scene/camera every frame, with
  // screenshot/device-frame/cutout content's *material* temporarily swapped
  // to opaque black (render() below, via darkenNoBloomObjects/restoreMaterials)
  // rather than hidden outright — swapping to black keeps that content's
  // silhouette physically blocking whatever sits behind it (the mesh-
  // gradient background) from leaking into the bloom source at all. An
  // earlier version of this fix hid the content instead (via camera.layers),
  // which stopped it from being a bloom source but left a background-shaped
  // hole for the colorful background *behind* it to bleed through and tint
  // the screenshot anyway — measured directly: a pure white (255,255,255)
  // source pixel still came out magenta-cast even with that version. Output
  // is a glow-only texture, added back into the main composer below rather
  // than replacing anything.
  const bloomComposer = new EffectComposer(renderer);
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(new RenderPass(scene, camera));
  // Subtle per docs/MOTION_GUIDE.md — bloomComposer already hard-excludes
  // every NO_BLOOM_LAYER (surface) mesh from the bloom source regardless of
  // threshold (darkenNoBloomObjects swaps it to opaque black before this
  // composer renders, so it reads as zero luminance no matter what),
  // so threshold now only discriminates among what's LEFT: particles,
  // accent-colored CTAs, headline text, stickers. threshold=0.94 (tuned
  // back when it was the only thing keeping white cards from blooming) was
  // never actually retuned once the exclusion took over that job — measured
  // directly: palette.ui (#6D5BFF, the chat-bubble/pay-button accent) has
  // perceptual luminance ~0.42 and palette's saturated success-green
  // (#16B364) ~0.55, both comfortably under 0.94, so most colored accents
  // and particles (confetti, the pay button) never crossed the old
  // threshold and rendered with no glow at all — only literally white
  // content (headline text, white confetti pieces, luminance 1.0) did.
  // Lowered to 0.5 so saturated accent colors bloom too, confirmed via
  // rendered frames across all four templates (reactions/checkout/insights/
  // showcase): headline text and the CTA/pay-button/confetti/heart
  // particles all show a visible soft glow now, chat bubbles/cards/stat
  // panels stay crisp (unaffected by threshold — excluded outright).
  const bloomOpts = opts.bloom ?? { strength: 0.22, radius: 0.35, threshold: 0.5 };
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), bloomOpts.strength, bloomOpts.radius, bloomOpts.threshold);
  bloomComposer.addPass(bloom);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  // Additively composites the bloom-only texture on top of the full,
  // everything-visible base render — never on top of a *darkened* base the
  // way some selective-bloom recipes do it, since nothing here needs to be
  // dimmed, only the bloom *source* needed restricting.
  const bloomMixPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloomComposer.readBuffer.texture } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv);
        }
      `,
    }),
    'baseTexture',
  );
  composer.addPass(bloomMixPass);

  const bokeh = new BokehPass(scene, camera, { focus: cameraZ, aperture: 0.00002, maxblur: 0.0 });
  composer.addPass(bokeh);

  // 3-5% grain per docs/MOTION_GUIDE.md. ScaledGrainPass (not three's stock
  // FilmPass) quantizes noise into cells sized relative to stageH so grain
  // looks the same size at 720p/1080p/4K instead of shrinking to
  // per-physical-pixel noise at higher resolutions.
  const film = new ScaledGrainPass(opts.grainIntensity ?? 0.04, stageH);
  composer.addPass(film);

  composer.addPass(new OutputPass());

  // Selective tone-mapping exemption — the *other* half of the render-
  // regression fix, needed even with toneMapped=false already set on
  // screenshot/frame/cutout materials (sceneBuilder.ts's
  // markAsScreenshotContent): verified directly against this three.js
  // version's OutputPass source that it applies renderer.toneMapping to
  // the *entire* already-composited texture, regardless of what any
  // individual material's toneMapped flag did during its own earlier
  // RenderPass — so toneMapped=false alone doesn't exempt anything once
  // OutputPass has run. Measured before this fix: a pure white
  // (255,255,255) source pixel rendered as ~(226,224,222), an ACES-
  // characteristic ~11% highlight compression, uniform (not a hue shift —
  // that part was the bloom bug above) but still a real, measurable
  // violation of "must look exactly as... correctly coloured as the
  // source image." Fixed with the same selective-render pattern as bloom:
  // a separate composer renders *only* NO_BLOOM_LAYER content (camera
  // restricted to that layer), with the scene background and render
  // target both made transparent and NoToneMapping active just for this
  // render, so its output is genuinely tone-mapping-exempt wherever it
  // drew something. A final alpha-composite pass (screenshotOverlayPass,
  // added after composer's own OutputPass below) then overlays that
  // result on top of the normally-tone-mapped main image, replacing only
  // the pixels it actually covered — both textures are fully resolved,
  // final sRGB output by the time they're mixed, so this is a same-space,
  // straightforward "over" blend, not a linear/sRGB mismatch.
  const screenshotComposer = new EffectComposer(renderer);
  screenshotComposer.renderToScreen = false;
  screenshotComposer.addPass(new RenderPass(scene, camera, undefined, undefined, 0));
  screenshotComposer.addPass(new OutputPass());

  const screenshotOverlayPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: { baseTexture: { value: null }, screenshotTexture: { value: null }, protectTexture: { value: null } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D screenshotTexture;
        uniform sampler2D protectTexture;
        varying vec2 vUv;
        void main() {
          vec4 ss = texture2D(screenshotTexture, vUv);
          vec3 base = texture2D(baseTexture, vUv).rgb;
          // protect.a > 0 means non-surface content (particle/CTA/headline)
          // drew something here — see nonSurfaceMaskTarget's doc comment —
          // so don't let the surface overlay cover it even where ss.a > 0.
          float protect = texture2D(protectTexture, vUv).a;
          gl_FragColor = vec4(mix(base, ss.rgb, ss.a * (1.0 - protect)), 1.0);
        }
      `,
    }),
    'baseTexture',
  );
  composer.addPass(screenshotOverlayPass);

  // Tier 2 item 14 — vignette, project-level slider. Defaults to 0 (off),
  // so every existing project/template renders unchanged; applied last
  // (after the screenshot overlay) since a vignette darkening the frame's
  // corners is a deliberate, user-dialed exposure choice that should
  // affect the whole composed image, not something screenshot content
  // needs exempting from the way bloom/tone-mapping did.
  const vignette = new VignettePass(opts.vignetteIntensity ?? 0);
  composer.addPass(vignette);

  // Selective-bloom material swap (see bloomComposer's doc comment above).
  // A single shared black material (nothing about it needs to vary per
  // mesh) and a map of what to restore afterward — array form handles a
  // multi-material mesh, though nothing here currently uses one.
  const blackMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const savedMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  const NO_BLOOM_BIT = 1 << NO_BLOOM_LAYER;
  function darkenNoBloomObjects(): void {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && (obj.layers.mask & NO_BLOOM_BIT) !== 0) {
        savedMaterials.set(obj, obj.material as THREE.Material | THREE.Material[]);
        obj.material = blackMaterial;
      }
    });
  }
  function restoreMaterials(): void {
    savedMaterials.forEach((mat, obj) => {
      obj.material = mat;
    });
    savedMaterials.clear();
  }

  // Non-surface coverage mask (occlusion fix for the tone-mapping-exemption
  // overlay below): screenshotOverlayPass composites screenshotComposer's
  // surface-only render on top of the base image as a flat 2D alpha blend,
  // with no depth information — so wherever *anything* bloom-eligible
  // (a particle, the CTA, headline text) visually overlaps a surface at the
  // same screen pixel, the surface pixel silently wins and erases it,
  // regardless of which is actually in front in the real 3D scene. Caught
  // by rendering reactions.ts's heart-burst particles: fully present and
  // correctly positioned in the scene graph (verified via a bare
  // renderer.render(scene,camera) with no post-processing), yet invisible
  // once the full composer chain ran — bisected pass-by-pass to
  // screenshotOverlayPass specifically. A depth-buffer comparison can't fix
  // this: particle sprites use depthWrite:false on purpose (correct, so
  // overlapping transparent particles don't occlude each other), so they'd
  // never appear in any depth texture regardless. Instead: render a mask of
  // exactly where non-surface content drew something (hide, not darken,
  // every NO_BLOOM_LAYER mesh so only the rest of the scene shows, same
  // transparent-background technique as screenshotComposer), and use its
  // alpha to protect those pixels from the surface overlay outright. This
  // is also the semantically correct rule for this app specifically: a
  // particle/CTA/headline overlapping a surface should always stay visible
  // on top — nothing in this UI relies on a surface ever legitimately
  // covering an accent.
  const hiddenNoBloomObjects: THREE.Mesh[] = [];
  function hideNoBloomObjects(): void {
    scene.traverse((obj) => {
      // The background plane is excluded here too (see its own
      // isBackgroundPlane doc comment in background.ts) — otherwise hiding
      // every surface mesh in front of it reveals it at full, frame-wide
      // coverage and floods the mask.
      const isMaskTarget = (obj.layers.mask & NO_BLOOM_BIT) !== 0 || obj.userData.isBackgroundPlane === true;
      if (obj instanceof THREE.Mesh && isMaskTarget && obj.visible) {
        obj.visible = false;
        hiddenNoBloomObjects.push(obj);
      }
    });
  }
  function restoreVisibility(): void {
    hiddenNoBloomObjects.forEach((obj) => {
      obj.visible = true;
    });
    hiddenNoBloomObjects.length = 0;
  }
  const nonSurfaceMaskTarget = new THREE.WebGLRenderTarget(width, height);

  // BokehPass's blur radius is a fixed number of physical pixels
  // (independent of render resolution — see BokehShader2's `w = (1/textureWidth)*blur*maxblur`,
  // which cancels textureWidth out), so the same maxblur value would blur a
  // shrinking fraction of the frame as resolution grows. Scale it by
  // height/stageH so DOF covers the same fraction of frame at every
  // export resolution (docs/MOTION_GUIDE.md).
  let pixelScale = height / stageH;
  // Tracked so setStageH() (which doesn't receive fresh pixel dimensions
  // itself) can re-derive pixelScale/grain-cell-size against whatever the
  // canvas's *current* actual output size already is.
  let lastW = width;
  let lastH = height;

  function setSize(w: number, h: number): void {
    lastW = w;
    lastH = h;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setSize(w, h);
    bloomComposer.setSize(w, h);
    screenshotComposer.setSize(w, h);
    nonSurfaceMaskTarget.setSize(w, h);
    bloom.setSize(w, h);
    film.setSize(w, h);
    pixelScale = h / stageH;
  }
  setSize(width, height);

  function setStageH(h: number): void {
    stageH = h;
    cameraZ = cameraZFor(stageH);
    film.setReferenceHeight(stageH);
    pixelScale = lastH / stageH;
    film.setSize(lastW, lastH);
  }

  return {
    camera,
    composer,
    setSize,
    setStageH,
    update(t, track, style) {
      const zoom = evaluateProperty(t, track.zoom, style);
      const x = evaluateProperty(t, track.position.x, style);
      const y = evaluateProperty(t, track.position.y, style);
      const z = evaluateProperty(t, track.position.z, style);
      const tx = evaluateProperty(t, track.target.x, style);
      const ty = evaluateProperty(t, track.target.y, style);
      const tz = evaluateProperty(t, track.target.z, style);
      const rx = evaluateProperty(t, track.rotation.rx, style);
      const ry = evaluateProperty(t, track.rotation.ry, style);
      const rz = evaluateProperty(t, track.rotation.rz, style);
      const fov = evaluateProperty(t, track.fov, style);

      // Toggleable idle drift, independent of authored keyframes — a
      // camera that's otherwise holding still per docs/MOTION_GUIDE.md
      // ("at most one major camera move per ~2 seconds... subtle
      // continuous drift (0.5-1% scale) between moves"). Off entirely for
      // a template that wants a deliberately locked-off shot.
      const drift = track.drift === false ? 1 : 1 + Math.sin(t * 0.22) * 0.006 + Math.sin(t * 0.37 + 1.7) * 0.003;
      const effectiveZoom = zoom * drift;

      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }

      // Dolly along Z for zoom (reads as a push-in, matching the reference's
      // scale-based zoom) rather than narrowing FOV, which would distort.
      const cz = (cameraZ + z) / Math.max(0.05, effectiveZoom);
      camera.position.set(x, -y, cz);
      // lookAt() fully overwrites the camera's orientation (it computes a
      // fresh quaternion facing the target) — any rx/ry/rz set beforehand
      // would just be discarded. So: point at the target first, then
      // compose the authored rotation on top as an extra offset.
      camera.lookAt(tx, -ty, tz);
      if (rx || ry || rz) {
        const extra = EXTRA_ROTATION_EULER.set(THREE.MathUtils.degToRad(rx), THREE.MathUtils.degToRad(ry), THREE.MathUtils.degToRad(rz));
        camera.quaternion.multiply(EXTRA_ROTATION_QUAT.setFromEuler(extra));
      }

      // DOF grows with zoom past 1 — same curve family as the reference's
      // `Math.min(14, Math.max(0, (zoom-1)*70))` px blur. Rack focus (Tier
      // 1 part B) shifts the focus plane independently of zoom via
      // focusOffset, and should blur *something* even at zoom=1 (that's
      // the whole point of a rack — sharpness moves without a push), so
      // the two contributions take the larger, not a sum (an already-
      // pushed-in shot doing a small rack shouldn't double up on blur).
      const focusOffset = track.focusOffset ? evaluateProperty(t, track.focusOffset, style) : 0;
      const dofFromZoom = Math.min(14, Math.max(0, (zoom - 1) * 70));
      const dofFromRack = Math.min(14, Math.abs(focusOffset) * 0.06);
      const dofPx = Math.max(dofFromZoom, dofFromRack);
      const bokehUniforms = bokeh.uniforms as { focus: { value: number }; maxblur: { value: number } };
      bokehUniforms.focus.value = cz + focusOffset;
      bokehUniforms.maxblur.value = (dofPx > 0.3 ? Math.min(0.018, 0.004 + dofPx * 0.0009) : 0.0) * pixelScale;

      return { zoom: effectiveZoom, x, y, ry };
    },
    render() {
      // Bloom-only pass: swap every NO_BLOOM_LAYER mesh's material to
      // opaque black just for this render (see the doc comment above
      // bloomComposer's creation for why black, not hidden) — restored
      // immediately after, before the main composer.render() below, which
      // renders every mesh with its real material as always.
      darkenNoBloomObjects();
      bloomComposer.render();
      restoreMaterials();
      // readBuffer can swap identity between renders (ping-pong pattern —
      // see EffectComposer.swapBuffers), so re-read it fresh every frame
      // rather than trusting the reference captured at construction time.
      (bloomMixPass.material as THREE.ShaderMaterial).uniforms.bloomTexture.value = bloomComposer.readBuffer.texture;

      // Screenshot-only, tone-mapping-exempt pass (see screenshotComposer's
      // doc comment above) — restricts the camera to NO_BLOOM_LAYER only,
      // nulls the scene background so uncovered pixels stay transparent,
      // and temporarily turns tone mapping off renderer-wide (OutputPass
      // reads this dynamically each render, so it's safe to flip back
      // immediately after — see its doc comment above).
      const prevBackground = scene.background;
      const prevToneMapping = renderer.toneMapping;
      scene.background = null;
      renderer.toneMapping = THREE.NoToneMapping;
      camera.layers.set(NO_BLOOM_LAYER);
      screenshotComposer.render();
      camera.layers.set(0);
      renderer.toneMapping = prevToneMapping;
      scene.background = prevBackground;
      (screenshotOverlayPass.material as THREE.ShaderMaterial).uniforms.screenshotTexture.value = screenshotComposer.readBuffer.texture;

      // Non-surface coverage mask (see nonSurfaceMaskTarget's doc comment) —
      // hides every NO_BLOOM_LAYER mesh so only particles/CTA/headline/etc.
      // render, transparent elsewhere, so screenshotOverlayPass can tell
      // where NOT to apply the surface overlay even though ss.a > 0 there.
      hideNoBloomObjects();
      const prevBackgroundMask = scene.background;
      scene.background = null;
      const prevClearAlpha = renderer.getClearAlpha();
      renderer.setClearAlpha(0);
      renderer.setRenderTarget(nonSurfaceMaskTarget);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.setClearAlpha(prevClearAlpha);
      scene.background = prevBackgroundMask;
      restoreVisibility();
      (screenshotOverlayPass.material as THREE.ShaderMaterial).uniforms.protectTexture.value = nonSurfaceMaskTarget.texture;

      composer.render();
    },
    dispose() {
      composer.dispose();
      bloomComposer.dispose();
      screenshotComposer.dispose();
      nonSurfaceMaskTarget.dispose();
      blackMaterial.dispose();
    },
    setGrainIntensity(v) {
      film.setIntensity(v);
    },
    setBloomStrength(v) {
      bloom.strength = v;
    },
    setVignetteIntensity(v) {
      vignette.setIntensity(v);
    },
  };
}
