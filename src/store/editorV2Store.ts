/**
 * Editor state for the Engine v2 layer editor (Prompt 5), built on Zustand
 * — same undo/redo shape as src/store/editorStore.ts (debounced 450ms
 * history commits, structuredClone snapshots), deliberately not sharing
 * code with it since that store is typed entirely around the classic
 * engine's Project/Slide model and this one is typed around
 * SceneProjectV2/LayerDef. The classic editor (`/editor`) and this one
 * (`/editor2`) are independent and neither depends on the other.
 */
import { create } from 'zustand';

import type { EngineFormat } from '@/engine2/camera';
import { getCameraPreset, type CameraAxis, type CameraTarget } from '@/engine2/cameraPresets';
import type { PaletteId } from '@/engine2/palettes';
import { getPreset, STAGGER_SECONDS } from '@/engine2/presets';
import { SOURCE_H, SOURCE_W } from '@/engine2/recipeKit';
import type { StyleId } from '@/engine2/styles';
import { constTrack, type Axis, type CameraLayerDef, type DeviceFrameSpec, type ImageAsset, type KeyframeStep, type LayerDef, type LayerPlane, type ParticleBurstDef, type SceneProjectV2, type StickerIdle } from '@/engine2/types';
import { createStickerLayer } from '@/engine2/stickerKit';
import { newAssetId } from '@/lib/assetSrc';
import type { Plan } from '@/lib/plan';

const HISTORY_LIMIT = 80;
const COMMIT_DEBOUNCE_MS = 450;

interface History {
  stack: SceneProjectV2[];
  i: number;
}

export interface SelectedKeyframe {
  layerId: string;
  axis: Axis;
  index: number;
}

interface EditorV2State {
  project: SceneProjectV2 | null;
  /** Real decoded images (uploaded screenshots, sticker PNGs) keyed by
   * slot id — outside the undo/redo history on purpose, same reason the
   * classic editor's `assets` is separate from its `project`: a decoded
   * HTMLImageElement can't survive structuredClone. Video doesn't need
   * this — VideoProps.src is a plain blob:/https: URL, not a slot id. */
  assets: Record<string, ImageAsset>;
  /** Uploaded music, decoded to an AudioBuffer — outside history for the
   * same reason `assets` is (can't structuredClone an AudioBuffer). Export
   * reads this directly instead of the hardcoded `null` it used before
   * Tier 1 item 4. */
  music: { buffer: AudioBuffer; name: string } | null;
  musicVolume: number;
  /** The Supabase projects.id this editor session is persisting to, or
   * null for a not-yet-saved/local-only project (e.g. /dev pages) —
   * mirrors editorStore.ts's identical field exactly. Uploaded assets are
   * stored under Storage paths keyed by this id (AddMenu/ProjectPanel
   * read it before calling uploadAsset()). */
  projectId: string | null;
  /** The signed-in user's plan (defaults to 'free') — mirrors
   * editorStore.ts's identical field. Drives the export watermark and
   * resolution cap. */
  plan: Plan;
  setPlan: (plan: Plan) => void;
  selectedIds: string[];
  selectedKeyframe: SelectedKeyframe | null;
  canUndo: boolean;
  canRedo: boolean;
  playheadT: number;

  registerAsset: (slotId: string, image: ImageAsset) => void;
  selectKeyframe: (kf: SelectedKeyframe | null) => void;
  loadProject: (project: SceneProjectV2, projectId?: string | null) => void;
  setPlayhead: (t: number) => void;
  /** Tier 1 item 1 — every template authors in a fixed design space, so
   * switching format is just this one field; sceneBuilder.ts's
   * contentScale does the rest (see its own doc comment). */
  setFormat: (format: EngineFormat) => void;
  /* ---- Tier 1: text, style, palette, screenshots, music, remix ---- */
  setStyle: (styleId: StyleId) => void;
  setPalette: (paletteId: PaletteId) => void;
  /** Project-wide default device frame (Tier 1 must-have #1) — pass null to
   * clear it back to "no frame". Applies to every screenshot layer that
   * doesn't set its own `content.device` (see setLayerDevice). */
  setDevice: (device: DeviceFrameSpec | null) => void;
  /** Per-layer device frame override — only meaningful on a 'screenshot'
   * layer (no-op otherwise); pass null to fall back to the project-wide
   * default set by setDevice. */
  setLayerDevice: (layerId: string, device: DeviceFrameSpec | null) => void;
  setAppName: (name: string) => void;
  /** Tier 2 item 14 — post-process sliders. Pass undefined to reset to
   * camera.ts's built-in default. */
  setGrainIntensity: (v: number | undefined) => void;
  setBloomStrength: (v: number | undefined) => void;
  setVignetteIntensity: (v: number | undefined) => void;
  /** Tier 1 part C follow-up: content shown on a layer's reverse face
   * during a flip preset (deviceFlipToSecond/cutoutFlipReveal) — see
   * LayerDef.backContent's doc comment. Pass null to remove it. */
  setLayerBackContent: (layerId: string, backContent: LayerDef['backContent'] | null) => void;
  /** index 0/1 = the two headline beats (t1/t2), index 2 = the CTA button
   * label (t3) — see reactions.ts's 'cta' recipe reading texts[2]. */
  setText: (index: 0 | 1 | 2, value: string) => void;
  /** Adds a brand-new 'screenshot' layer (plane:'device', the same
   * SOURCE_W/SOURCE_H every recipe's screenLayer() uses) from an uploaded
   * image. To *swap* an existing screenshot layer's image instead, just
   * call registerAsset() again with that layer's existing slotId — it's
   * a plain keyed map, so re-registering replaces it and the next scene
   * rebuild (assets is in Stage2's effect deps) picks up the new pixels
   * with the layer's position/size/animation untouched. */
  addScreenshotLayer: (image: ImageAsset, label: string) => { layerId: string; slotId: string };
  setMusic: (music: { buffer: AudioBuffer; name: string } | null) => void;
  setMusicVolume: (v: number) => void;
  /** Sets the *persisted* reference (project.musicAssetId) — separate from
   * setMusic()'s runtime AudioBuffer since only this half survives a save/
   * reload. Called once the raw file has actually finished uploading to
   * Storage (see ProjectPanel.tsx); pass null to clear music entirely. */
  setMusicAssetId: (assetId: string | null) => void;
  /** Replaces the current project's content with a remix result — routed
   * through `update()` (undoable, autosaves) rather than loadProject()
   * (which would reset history), since a remix is meant to feel like a
   * big edit to keep iterating on, not a fresh start. */
  applyRemix: (project: SceneProjectV2) => void;

  select: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;

  reorderLayer: (id: string, toIndex: number) => void;
  toggleVisible: (id: string) => void;
  toggleLock: (id: string) => void;
  setPlane: (id: string, plane: LayerPlane) => void;
  removeLayer: (id: string) => void;
  groupSelected: () => void;
  ungroup: (groupId: string) => void;

  moveLayerTiming: (id: string, deltaSeconds: number) => void;
  scaleLayerTiming: (id: string, factor: number, anchor: number) => void;
  updateKeyframe: (layerId: string, axis: Axis, stepIndex: number, patch: Partial<KeyframeStep>) => void;
  removeKeyframe: (layerId: string, axis: Axis, stepIndex: number) => void;

  applyPreset: (layerIds: string[], presetId: string, atBase: number) => void;
  /** Camera preset (Tier 1 part B) — `targetLayerId` is the target picker
   * every camera preset needs (null for a target-less one like Still/
   * Handheld, or for aiming at wherever the camera already rests). Always
   * replaces whatever steps already exist on the axes it touches (see
   * cameraPresets.ts's doc comment on why this doesn't append like
   * layer presets do). */
  applyCameraPreset: (presetId: string, targetLayerId: string | null, atBase: number) => void;

  setLayerBase: (id: string, axis: Axis, value: number) => void;

  /* ---- Prompt 7: rich media layers ---- */
  addLottieLayer: (data: object, label: string) => string;
  addVideoLayer: (src: string, label: string) => string;
  addEmojiStickerLayer: (emoji: string, idle: StickerIdle) => string;
  addImageStickerLayer: (slotId: string, image: ImageAsset, label: string, idle: StickerIdle) => string;
  updateVideoProps: (layerId: string, patch: { trimStart?: number; trimEnd?: number; speed?: number; freezeAt?: number | null }) => void;
  /** Infrastructure merge — sets a video layer's *persisted* Storage
   * reference once the raw upload actually finishes (VideoProps.src stays
   * whatever locally-playable blob:/signed URL it already had; assetId is
   * what survives a save/reload — see usePersistenceV2.ts and
   * VideoProps.assetId's doc comment). */
  setVideoAssetId: (layerId: string, assetId: string) => void;
  addParticleBurstOnLayer: (originLayerId: string, kind: ParticleBurstDef['kind'], at: number, seedOffset: number) => string;
  removeParticleBurst: (id: string) => void;
  /** Cutout follow-up: pops a rounded-rect crop of `sourceLayerId`'s own
   * live content (screenshot/video/lottie/ui-element) up and out, dimming
   * the source underneath (`liftOf`) — see sceneBuilder.ts's
   * resolveCutoutSourceTexture for how sourceSlotId=sourceLayerId is
   * resolved to that layer's live texture. `rectUv` defaults to a centered
   * half-size box when omitted. */
  addCutoutFromLayer: (sourceLayerId: string, rectUv?: [number, number, number, number]) => string;
  /** Cutout preset "Trail" (Tier 1 part C) — unlike every other preset,
   * this can't be expressed as a keyframe patch on the existing layer: it
   * needs 2-3 actual ghost duplicates. Each ghost reuses the leader's
   * *current* transform with every keyframe's `at` shifted later by a
   * growing delay — since evaluateProperty's spring is a pure function of
   * elapsed time, shifting a step's `at` later makes that step's evaluated
   * value at any time `t` exactly equal the leader's value at `t - delay`,
   * i.e. a genuine time-delayed echo, not a separately-authored animation
   * that merely looks similar. Ghosts fade progressively and sit slightly
   * behind the leader in z so it stays on top where they overlap. */
  applyCutoutTrail: (leaderLayerId: string, ghostCount?: number) => void;

  commitNow: () => void;
  undo: () => void;
  redo: () => void;
}

let commitTimer: ReturnType<typeof setTimeout> | null = null;
const history: History = { stack: [], i: -1 };

function resetHistory(project: SceneProjectV2) {
  if (commitTimer) {
    clearTimeout(commitTimer);
    commitTimer = null;
  }
  history.stack = [structuredClone(project)];
  history.i = 0;
}

function mapLayer(project: SceneProjectV2, id: string, fn: (l: LayerDef) => LayerDef): SceneProjectV2 {
  return { ...project, layers: project.layers.map((l) => (l.id === id ? fn(l) : l)) };
}

/** Reads/writes CameraLayerDef's nested position/target/rotation/zoom/fov/
 * focusOffset fields by a flat CameraAxis key — the write side always
 * shallow-copies the nested object it touches (position/target/rotation),
 * keeping this an immutable update like every other store action. */
function cameraTrackFor(camera: CameraLayerDef, axis: CameraAxis) {
  switch (axis) {
    case 'px':
      return camera.position.x;
    case 'py':
      return camera.position.y;
    case 'pz':
      return camera.position.z;
    case 'tx':
      return camera.target.x;
    case 'ty':
      return camera.target.y;
    case 'tz':
      return camera.target.z;
    case 'rx':
      return camera.rotation.rx;
    case 'ry':
      return camera.rotation.ry;
    case 'rz':
      return camera.rotation.rz;
    case 'zoom':
      return camera.zoom;
    case 'fov':
      return camera.fov;
    case 'focusOffset':
      return camera.focusOffset ?? { base: 0, steps: [] };
  }
}

function setCameraTrack(camera: CameraLayerDef, axis: CameraAxis, track: ReturnType<typeof cameraTrackFor>): void {
  switch (axis) {
    case 'px':
      camera.position = { ...camera.position, x: track };
      return;
    case 'py':
      camera.position = { ...camera.position, y: track };
      return;
    case 'pz':
      camera.position = { ...camera.position, z: track };
      return;
    case 'tx':
      camera.target = { ...camera.target, x: track };
      return;
    case 'ty':
      camera.target = { ...camera.target, y: track };
      return;
    case 'tz':
      camera.target = { ...camera.target, z: track };
      return;
    case 'rx':
      camera.rotation = { ...camera.rotation, rx: track };
      return;
    case 'ry':
      camera.rotation = { ...camera.rotation, ry: track };
      return;
    case 'rz':
      camera.rotation = { ...camera.rotation, rz: track };
      return;
    case 'zoom':
      camera.zoom = track;
      return;
    case 'fov':
      camera.fov = track;
      return;
    case 'focusOffset':
      camera.focusOffset = track;
      return;
  }
}

/** Applies `fn` to every axis track a layer has (used by timing move/scale,
 * which shift a layer's whole animation uniformly regardless of which
 * axes it happens to animate). */
function mapLayerTracks(layer: LayerDef, fn: (track: LayerDef['transform'][Axis]) => LayerDef['transform'][Axis]): LayerDef {
  const transform = { ...layer.transform };
  (Object.keys(transform) as Axis[]).forEach((axis) => {
    const track = transform[axis];
    if (track) transform[axis] = fn(track);
  });
  return { ...layer, transform };
}

export const useEditorV2Store = create<EditorV2State>((set, get) => {
  function scheduleCommit() {
    if (commitTimer) clearTimeout(commitTimer);
    commitTimer = setTimeout(commitNowImpl, COMMIT_DEBOUNCE_MS);
  }

  function commitNowImpl() {
    const hadPendingEdit = commitTimer !== null;
    if (commitTimer) {
      clearTimeout(commitTimer);
      commitTimer = null;
    }
    const project = get().project;
    if (!project) return;
    // Mirrors editorStore.ts's commitNowImpl — skips pushing a duplicate
    // snapshot when nothing actually changed since the last commit, or
    // undo()'s mandatory flush would eat the user's first Undo click.
    if (!hadPendingEdit && JSON.stringify(history.stack[history.i]) === JSON.stringify(project)) return;
    history.stack = history.stack.slice(0, history.i + 1);
    history.stack.push(structuredClone(project));
    if (history.stack.length > HISTORY_LIMIT) history.stack.shift();
    history.i = history.stack.length - 1;
    set({ canUndo: history.i > 0, canRedo: history.i < history.stack.length - 1 });
  }

  function update(fn: (project: SceneProjectV2) => SceneProjectV2) {
    const project = get().project;
    if (!project) return;
    set({ project: fn(project) });
    scheduleCommit();
  }

  return {
    project: null,
    assets: {},
    music: null,
    musicVolume: 0.8,
    projectId: null,
    plan: 'free',
    setPlan: (plan) => set({ plan }),
    selectedIds: [],
    selectedKeyframe: null,
    canUndo: false,
    canRedo: false,
    playheadT: 0,

    registerAsset: (slotId, image) => set((s) => ({ assets: { ...s.assets, [slotId]: image } })),
    selectKeyframe: (kf) => set({ selectedKeyframe: kf }),
    loadProject: (project, projectId = null) => {
      resetHistory(project);
      set({ project, projectId, selectedIds: [], selectedKeyframe: null, canUndo: false, canRedo: false, playheadT: 0 });
    },
    setPlayhead: (t) => set({ playheadT: t }),
    setFormat: (format) => update((p) => ({ ...p, format })),
    setStyle: (styleId) => update((p) => ({ ...p, styleId })),
    setPalette: (paletteId) => update((p) => ({ ...p, paletteId })),
    setDevice: (device) => update((p) => ({ ...p, device: device ?? undefined })),
    setLayerDevice: (layerId, device) =>
      update((p) =>
        mapLayer(p, layerId, (l) => {
          if (l.content.kind !== 'screenshot') return l;
          return { ...l, content: { ...l.content, device: device ?? undefined } };
        }),
      ),
    setAppName: (name) => update((p) => ({ ...p, appName: name })),
    setGrainIntensity: (v) => update((p) => ({ ...p, grainIntensity: v })),
    setBloomStrength: (v) => update((p) => ({ ...p, bloomStrength: v })),
    setVignetteIntensity: (v) => update((p) => ({ ...p, vignetteIntensity: v })),
    setLayerBackContent: (layerId, backContent) =>
      update((p) => mapLayer(p, layerId, (l) => ({ ...l, backContent: backContent ?? undefined }))),
    setText: (index, value) =>
      update((p) => {
        const texts: [string, string, string] = [...p.texts];
        texts[index] = value;
        return { ...p, texts };
      }),
    addScreenshotLayer: (image, label) => {
      const slotId = newAssetId('shot');
      set((s) => ({ assets: { ...s.assets, [slotId]: image } }));
      const id = newAssetId('screenshot');
      // Device motion presets: a new device layer starts at a slight 3D
      // angle, not flat-on — flat is what makes a render look like an
      // un-styled template. Only the creation path (a real upload via the
      // + Add menu), not recipeKit.ts's screenLayer() used by hand-authored
      // templates/recipes, which already choose their own deliberate poses.
      const layer: LayerDef = {
        id,
        label,
        plane: 'device',
        content: { kind: 'screenshot', slotId },
        width: SOURCE_W,
        height: SOURCE_H,
        overrides: {},
        transform: { rx: constTrack(8), ry: constTrack(-14), rz: constTrack(2) },
      };
      update((p) => ({ ...p, layers: [...p.layers, layer] }));
      set({ selectedIds: [id] });
      return { layerId: id, slotId };
    },
    setMusic: (music) => set({ music }),
    setMusicVolume: (v) => set({ musicVolume: v }),
    setMusicAssetId: (assetId) => update((p) => ({ ...p, musicAssetId: assetId ?? undefined })),
    applyRemix: (project) => update(() => project),

    select: (ids, additive) =>
      set((s) => ({ selectedIds: additive ? [...new Set([...s.selectedIds, ...ids])] : ids })),
    clearSelection: () => set({ selectedIds: [] }),

    reorderLayer: (id, toIndex) =>
      update((p) => {
        const from = p.layers.findIndex((l) => l.id === id);
        if (from < 0) return p;
        const layers = [...p.layers];
        const [moved] = layers.splice(from, 1);
        layers.splice(Math.max(0, Math.min(layers.length, toIndex)), 0, moved);
        return { ...p, layers };
      }),
    toggleVisible: (id) => update((p) => mapLayer(p, id, (l) => ({ ...l, visible: l.visible === false }))),
    toggleLock: (id) => update((p) => mapLayer(p, id, (l) => ({ ...l, locked: !l.locked }))),
    setPlane: (id, plane) => update((p) => mapLayer(p, id, (l) => ({ ...l, plane }))),
    removeLayer: (id) => {
      update((p) => ({ ...p, layers: p.layers.filter((l) => l.id !== id) }));
      set((s) => ({ selectedIds: s.selectedIds.filter((sid) => sid !== id) }));
    },
    groupSelected: () => {
      const { selectedIds } = get();
      if (selectedIds.length < 2) return;
      const groupId = `grp-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
      update((p) => ({ ...p, layers: p.layers.map((l) => (selectedIds.includes(l.id) ? { ...l, groupId } : l)) }));
    },
    ungroup: (groupId) => update((p) => ({ ...p, layers: p.layers.map((l) => (l.groupId === groupId ? { ...l, groupId: undefined } : l)) })),

    moveLayerTiming: (id, deltaSeconds) =>
      update((p) =>
        mapLayer(p, id, (l) =>
          mapLayerTracks(l, (track) => (track ? { ...track, steps: track.steps.map((s) => ({ ...s, at: Math.max(0, s.at + deltaSeconds) })) } : track)),
        ),
      ),
    scaleLayerTiming: (id, factor, anchor) =>
      update((p) =>
        mapLayer(p, id, (l) =>
          mapLayerTracks(l, (track) => (track ? { ...track, steps: track.steps.map((s) => ({ ...s, at: Math.max(0, anchor + (s.at - anchor) * factor) })) } : track)),
        ),
      ),
    updateKeyframe: (layerId, axis, stepIndex, patch) =>
      update((p) =>
        mapLayer(p, layerId, (l) => {
          const track = l.transform[axis];
          if (!track || !track.steps[stepIndex]) return l;
          const steps = track.steps.map((s, i) => (i === stepIndex ? { ...s, ...patch } : s));
          return { ...l, transform: { ...l.transform, [axis]: { ...track, steps } } };
        }),
      ),
    removeKeyframe: (layerId, axis, stepIndex) =>
      update((p) =>
        mapLayer(p, layerId, (l) => {
          const track = l.transform[axis];
          if (!track) return l;
          return { ...l, transform: { ...l.transform, [axis]: { ...track, steps: track.steps.filter((_, i) => i !== stepIndex) } } };
        }),
      ),

    applyPreset: (layerIds, presetId, atBase) => {
      const preset = getPreset(presetId);
      if (!preset) return;
      update((p) => ({
        ...p,
        layers: p.layers.map((l) => {
          if (!layerIds.includes(l.id)) return l;
          // Stagger by *selection* order, not array order, so the user's
          // click order controls which layer leads (MOTION_GUIDE.md: 40-70ms).
          const staggerIndex = layerIds.indexOf(l.id);
          const at = atBase + staggerIndex * STAGGER_SECONDS;
          const patch = preset.apply(l, at, { index: staggerIndex, total: layerIds.length });
          const transform = { ...l.transform };
          (Object.keys(patch) as Axis[]).forEach((axis) => {
            const axisPatch = patch[axis];
            if (!axisPatch) return;
            const existing = transform[axis] ?? { base: 0, steps: [] };
            // 'idle' presets never carry steps (they only ever set
            // float/spin — see presets.ts's PresetCategory doc comment), so
            // an empty axisPatch.steps means "leave whatever enter/emphasis/
            // exit steps are already here alone" rather than "clear them" —
            // without this, applying Float after Swing in would wipe the
            // swing. 'enter' still fully replaces (a second enter preset
            // means "use this enter instead"); emphasis/exit still append.
            const steps = axisPatch.steps.length === 0 ? existing.steps : preset.category === 'enter' ? axisPatch.steps : [...existing.steps, ...axisPatch.steps];
            transform[axis] = {
              ...existing,
              ...(axisPatch.base !== undefined ? { base: axisPatch.base } : {}),
              steps,
              ...(axisPatch.float !== undefined ? { float: axisPatch.float } : {}),
              ...(axisPatch.spin !== undefined ? { spin: axisPatch.spin } : {}),
            };
          });
          return { ...l, transform };
        }),
      }));
    },

    applyCameraPreset: (presetId, targetLayerId, atBase) => {
      const preset = getCameraPreset(presetId);
      if (!preset) return;
      update((p) => {
        const targetLayer = targetLayerId ? p.layers.find((l) => l.id === targetLayerId) : undefined;
        const target: CameraTarget = targetLayer
          ? { x: targetLayer.transform.x?.base ?? 0, y: targetLayer.transform.y?.base ?? 0, z: targetLayer.transform.z?.base ?? 0 }
          : null;
        const patch = preset.apply(p.camera, target, atBase);
        const camera: CameraLayerDef = { ...p.camera };
        (Object.keys(patch) as CameraAxis[]).forEach((axis) => {
          const axisPatch = patch[axis];
          if (!axisPatch) return;
          const existing = cameraTrackFor(camera, axis);
          // Every camera preset replaces (never appends) — MOTION_GUIDE.md's
          // "at most one major camera move per ~2 seconds" means a newly
          // applied preset is meant to supersede whatever move was there,
          // not queue up alongside it (contrast presets.ts's layer presets,
          // which deliberately do compose).
          const steps = axisPatch.steps.length === 0 ? existing.steps : axisPatch.steps;
          const nextTrack = {
            ...existing,
            ...(axisPatch.base !== undefined ? { base: axisPatch.base } : {}),
            steps,
            ...(axisPatch.float !== undefined ? { float: axisPatch.float } : {}),
          };
          setCameraTrack(camera, axis, nextTrack);
        });
        return { ...p, camera };
      });
    },

    setLayerBase: (id, axis, value) =>
      update((p) =>
        mapLayer(p, id, (l) => {
          const track = l.transform[axis] ?? { base: 0, steps: [] };
          return { ...l, transform: { ...l.transform, [axis]: { ...track, base: value } } };
        }),
      ),

    addLottieLayer: (data, label) => {
      const id = newAssetId('lottie');
      const layer: LayerDef = { id, label, plane: 'popout', content: { kind: 'lottie', props: { data, loop: true } }, width: 200, height: 200, overrides: {}, transform: {} };
      update((p) => ({ ...p, layers: [...p.layers, layer] }));
      set({ selectedIds: [id] });
      return id;
    },
    addVideoLayer: (src, label) => {
      const id = newAssetId('video');
      const layer: LayerDef = { id, label, plane: 'device', content: { kind: 'video', props: { src, loop: true, muted: true } }, width: 524, height: 1144, overrides: {}, transform: {} };
      update((p) => ({ ...p, layers: [...p.layers, layer] }));
      set({ selectedIds: [id] });
      return id;
    },
    addEmojiStickerLayer: (emoji, idle) => {
      const id = newAssetId('sticker');
      const layer = createStickerLayer({ id, label: `Sticker (${emoji})`, content: { kind: 'sticker', props: { emoji } }, width: 140, height: 140, idle });
      update((p) => ({ ...p, layers: [...p.layers, layer] }));
      set({ selectedIds: [id] });
      return id;
    },
    addImageStickerLayer: (slotId, image, label, idle) => {
      const id = newAssetId('sticker');
      set((s) => ({ assets: { ...s.assets, [slotId]: image } }));
      const layer = createStickerLayer({ id, label, content: { kind: 'sticker', props: { imageSlotId: slotId } }, width: 160, height: 160, idle });
      update((p) => ({ ...p, layers: [...p.layers, layer] }));
      set({ selectedIds: [id] });
      return id;
    },
    updateVideoProps: (layerId, patch) =>
      update((p) =>
        mapLayer(p, layerId, (l) => {
          if (l.content.kind !== 'video') return l;
          const props = { ...l.content.props };
          if (patch.trimStart !== undefined) props.trimStart = patch.trimStart;
          if (patch.trimEnd !== undefined) props.trimEnd = patch.trimEnd;
          if (patch.speed !== undefined) props.speed = patch.speed;
          if (patch.freezeAt !== undefined) props.freezeAt = patch.freezeAt ?? undefined;
          return { ...l, content: { ...l.content, props } };
        }),
      ),
    setVideoAssetId: (layerId, assetId) =>
      update((p) =>
        mapLayer(p, layerId, (l) => {
          if (l.content.kind !== 'video') return l;
          return { ...l, content: { ...l.content, props: { ...l.content.props, assetId } } };
        }),
      ),
    addParticleBurstOnLayer: (originLayerId, kind, at, seedOffset) => {
      const id = newAssetId('burst');
      const burst: ParticleBurstDef = { id, at, kind, originLayerId, count: 22, dir: -Math.PI / 2, spread: 2.3, speed: 480, gravity: 500, life: 1.5, seedOffset };
      update((p) => ({ ...p, particles: [...p.particles, burst] }));
      return id;
    },
    removeParticleBurst: (id) => update((p) => ({ ...p, particles: p.particles.filter((b) => b.id !== id) })),
    addCutoutFromLayer: (sourceLayerId, rectUv = [0.25, 0.25, 0.5, 0.5]) => {
      const project = get().project;
      const source = project?.layers.find((l) => l.id === sourceLayerId);
      if (!project || !source) return '';
      const id = newAssetId('cutout');
      const [, , w, h] = rectUv;
      const layer: LayerDef = {
        id,
        label: `Cutout of ${source.label}`,
        plane: 'popout',
        liftOf: sourceLayerId,
        content: { kind: 'cutout', sourceSlotId: sourceLayerId, rectUv, radiusPx: 24 },
        width: Math.round(source.width * w),
        height: Math.round(source.height * h),
        overrides: {},
        transform: {
          z: { base: 0, steps: [{ at: 0, to: 220, spring: 'wobbly' }] },
          y: { base: 0, steps: [{ at: 0, to: -60, spring: 'wobbly' }] },
          scale: { base: 0.6, steps: [{ at: 0, to: 1, spring: 'bouncy' }] },
          opacity: { base: 0, steps: [{ at: 0, to: 1, spring: 'snappy' }] },
        },
      };
      update((p) => ({ ...p, layers: [...p.layers, layer] }));
      set({ selectedIds: [id] });
      return id;
    },
    applyCutoutTrail: (leaderLayerId, ghostCount = 2) => {
      update((p) => {
        const leader = p.layers.find((l) => l.id === leaderLayerId);
        if (!leader) return p;
        const delayStep = 0.12;
        const ghosts: LayerDef[] = Array.from({ length: Math.max(1, Math.min(3, ghostCount)) }, (_, i) => {
          const n = i + 1;
          const delay = n * delayStep;
          const transform: LayerDef['transform'] = {};
          (Object.keys(leader.transform) as Axis[]).forEach((axis) => {
            const track = leader.transform[axis];
            if (!track) return;
            transform[axis] = { ...track, steps: track.steps.map((s) => ({ ...s, at: s.at + delay })) };
          });
          // Fainter and set slightly further back with each ghost, so the
          // leader always reads on top where paths cross.
          const restOpacity = transform.opacity?.base ?? 1;
          const restZ = transform.z?.base ?? 0;
          transform.opacity = { ...(transform.opacity ?? { base: restOpacity, steps: [] }), base: restOpacity * (0.4 / n) };
          transform.z = { ...(transform.z ?? { base: restZ, steps: [] }), base: restZ - 20 * n };
          return { ...leader, id: newAssetId('trail'), label: `${leader.label} trail ${n}`, transform, backContent: undefined };
        });
        const leaderIndex = p.layers.findIndex((l) => l.id === leaderLayerId);
        const layers = [...p.layers];
        layers.splice(leaderIndex, 0, ...ghosts);
        return { ...p, layers };
      });
    },

    commitNow: () => commitNowImpl(),
    undo: () => {
      commitNowImpl();
      if (history.i <= 0) return;
      history.i--;
      set({ project: structuredClone(history.stack[history.i]), canUndo: history.i > 0, canRedo: history.i < history.stack.length - 1 });
    },
    redo: () => {
      if (history.i >= history.stack.length - 1) return;
      history.i++;
      set({ project: structuredClone(history.stack[history.i]), canUndo: history.i > 0, canRedo: history.i < history.stack.length - 1 });
    },
  };
});
