/**
 * Editor state for Nimina, built on Zustand.
 *
 * `project` is the JSON-safe, database-persistable half of the state — it
 * matches src/engine's `Project` type exactly and never holds a DOM/decoded
 * object, only asset ids (strings). `assets` is the in-memory-only half:
 * decoded images and audio buffers keyed by the same ids. This split is
 * what lets `project` be saved/loaded from Supabase later without any
 * transformation.
 *
 * Undo/redo mirrors the prototype: every mutation schedules a debounced
 * (450ms) history commit, so rapid edits (typing, dragging a color picker)
 * collapse into one undo step, while undo()/redo() themselves flush any
 * pending commit first.
 */
import type { ElementKey, ElementXform, TextLayer } from '@/engine/elements';
import { addTextLayer, deleteElement, setStackOrder, setTextOf, setXforms, type ElementOwner } from './elementOps';
import { create } from 'zustand';

import { PRESETS } from '@/engine/constants';
import { collectStrings, hashText, newLanguageEntry } from '@/engine/localization';
import { createDefaultProject, normalizeProject } from '@/engine/project';
import { createImageSlide, createTextSlide } from '@/engine/slides';
import type {
  LanguageEntry,
  Action,
  ActionType,
  AssetMap,
  CameraKey,
  Colors,
  CutoutLayer,
  ImageAsset,
  ImageSlide,
  IntroConfig,
  OutroConfig,
  Point,
  Project,
  Slide,
  SlideStyle,
  Sprite,
  StorySlide,
  TextSlide,
} from '@/engine/types';
import { newAssetId } from '@/lib/assetSrc';
import { PLAN_LIMITS, type Plan } from '@/lib/plan';

const HISTORY_LIMIT = 80;
const COMMIT_DEBOUNCE_MS = 450;

export interface EditorAssets {
  images: AssetMap;
  /** decoded Web Audio buffers, keyed by the same id as project.music?.assetId */
  audio: Record<string, AudioBuffer>;
}

interface History {
  stack: Project[];
  i: number;
}

interface EditorState {
  project: Project;
  assets: EditorAssets;
  canUndo: boolean;
  canRedo: boolean;
  /** The Supabase projects.id this editor session is persisting to, or null
   * for a not-yet-saved/local-only project (e.g. /dev/engine). Uploaded
   * assets are stored under Storage paths keyed by this id. */
  projectId: string | null;
  /** The signed-in user's plan (defaults to 'free' — see src/lib/plan.ts),
   * set alongside projectId at hydration. Drives the export watermark,
   * resolution cap, and which devices/effects are selectable. */
  plan: Plan;
  setPlan: (plan: Plan) => void;

  /** Replaces the whole project (e.g. loading a saved one) and resets history. */
  loadProject: (project: Project, projectId: string | null, assets?: Partial<EditorAssets>) => void;

  /** Which slide the rail/filmstrip/Slide-tab are showing — independent of
   * playback position (the playhead can sit inside one slide while a
   * different one is open for editing). null only when there are no
   * scenes and intro is off. */
  selectedSceneId: number | 'intro' | 'outro' | null;
  selectScene: (id: number | 'intro' | 'outro') => void;

  /* ---- global (Look/Motion) defaults ---- */
  setFormat: (format: Project['format']) => void;
  setQuality: (quality: Project['quality']) => void;
  setAppName: (name: string) => void;
  setFont: (index: number) => void;
  setPreset: (index: number) => void;
  setColors: (colors: Partial<Colors>) => void;
  setModel: (model: Project['model']) => void;
  setFcolor: (fcolor: Project['fcolor']) => void;
  setBgPattern: (v: Project['bgPattern']) => void;
  setShapes: (v: boolean) => void;
  setGrain: (v: boolean) => void;
  setVignette: (v: boolean) => void;
  setStoryBars: (v: boolean) => void;
  setHlStyle: (v: Project['hlStyle']) => void;
  setTextPos: (v: Project['textPos']) => void;
  setTextAnim: (v: Project['textAnim']) => void;
  setTransition: (v: Project['transition']) => void;
  setMotionSpeed: (v: number) => void;

  /* ---- intro / outro ---- */
  setIntro: (patch: Partial<Omit<IntroConfig, 'style'>>) => void;
  setIntroStyle: (key: keyof SlideStyle, value: string | undefined) => void;
  resetIntroStyle: () => void;
  setOutro: (patch: Partial<Omit<OutroConfig, 'style'>>) => void;
  setOutroStyle: (key: keyof SlideStyle, value: string | undefined) => void;
  resetOutroStyle: () => void;

  /* ---- icon / music assets ---- */
  setIcon: (assetId: string, image: ImageAsset) => void;
  clearIcon: () => void;
  setMusic: (assetId: string, name: string, buffer: AudioBuffer, bpm?: number) => void;
  clearMusic: () => void;
  setVolume: (v: number) => void;
  setDucking: (v: boolean) => void;

  /* ---- slides ---- */
  registerImage: (assetId: string, image: ImageAsset) => void;
  addImageSlide: (assetId: string, overrides?: Partial<ImageSlide>) => string;
  addTextSlide: (overrides?: Partial<TextSlide>) => string;
  addStorySlide: () => string;
  updateSlide: (id: number, patch: Partial<ImageSlide> | Partial<TextSlide> | Partial<StorySlide>) => void;
  replaceSlideImage: (id: number, assetId: string, image: ImageAsset) => void;
  removeSlide: (id: number) => void;
  duplicateSlide: (id: number) => void;
  moveSlide: (id: number, dir: 1 | -1) => void;
  /** Moves a slide to just before `beforeId` (or to the end when null) — timeline drag-to-reorder. */
  moveSlideBefore: (id: number, beforeId: number | null) => void;
  /* ---- direct manipulation on the canvas (src/store/elementOps.ts) ---- */
  setElementXforms: (owner: ElementOwner, patch: Partial<Record<ElementKey, ElementXform | null>>) => void;
  setElementText: (owner: ElementOwner, key: ElementKey, text: string) => void;
  deleteElements: (owner: ElementOwner, keys: ElementKey[]) => void;
  addTextLayer: (owner: ElementOwner, layer: TextLayer, xf: ElementXform) => void;
  setElementStackOrder: (owner: ElementOwner, keysBottomToTop: ElementKey[]) => void;
  setSlideStyle: (id: number, key: keyof SlideStyle, value: string | undefined) => void;
  resetSlideStyle: (id: number) => void;
  applyStyleToAll: (id: number) => void;

  /* ---- cutouts (pop-out screenshot elements) ---- */
  addCutout: (slideId: number, rect: CutoutLayer['rect']) => string;
  updateCutout: (slideId: number, cutoutId: string, patch: Partial<Omit<CutoutLayer, 'id'>>) => void;
  removeCutout: (slideId: number, cutoutId: string) => void;

  /* ---- story slides ---- */
  addStoryScreen: (slideId: number, assetId: string) => string;
  setStoryScreenAsset: (slideId: number, screenId: string, assetId: string) => void;
  removeStoryScreen: (slideId: number, screenId: string) => void;
  moveStoryScreen: (slideId: number, screenId: string, dir: 1 | -1) => void;
  addStoryAction: (slideId: number, type: ActionType) => string;
  updateStoryAction: <A extends Action>(slideId: number, actionId: string, patch: Partial<A>) => void;
  removeStoryAction: (slideId: number, actionId: string) => void;
  moveStoryAction: (slideId: number, actionId: string, dir: 1 | -1) => void;
  reorderStoryActions: (slideId: number, fromIndex: number, toIndex: number) => void;
  setCameraMode: (slideId: number, mode: StorySlide['cameraMode']) => void;
  addCameraKey: (slideId: number, key: CameraKey) => void;
  updateCameraKey: (slideId: number, index: number, key: CameraKey) => void;
  removeCameraKey: (slideId: number, index: number) => void;
  addSprite: (slideId: number) => string;
  updateSprite: (slideId: number, spriteId: string, patch: Partial<Sprite>) => void;
  removeSprite: (slideId: number, spriteId: string) => void;
  addSpritePathPoint: (slideId: number, spriteId: string, point: Point) => void;
  updateSpritePathPoint: (slideId: number, spriteId: string, index: number, point: Point) => void;
  removeSpritePathPoint: (slideId: number, spriteId: string, index: number) => void;

  /* ---- undo/redo ---- */
  commitNow: () => void;
  undo: () => void;
  redo: () => void;

  /* ---- localization ---- */
  /** Which language the stage previews (null = the source). UI state —
   * not part of the project, not in undo history. */
  previewLocale: string | null;
  setPreviewLocale: (locale: string | null) => void;
  /** Turns a single-language project into a localized one whose source is `source`. */
  enableLocalization: (source: string) => void;
  /** Changes the source language's code — only while it's the only language. */
  setSourceLocale: (locale: string) => void;
  /** Adds `locale` with the source text cloned as its starting overrides.
   * Returns false (and changes nothing) when the plan's language limit is reached. */
  addLanguage: (locale: string) => boolean;
  removeLanguage: (locale: string) => void;
  /** Sets one string's translation (confirmed, against the current source text). */
  setTranslation: (locale: string, key: string, text: string) => void;
  /** Marks one string confirmed (or not) as it stands. */
  setTranslationDone: (locale: string, key: string, done: boolean) => void;
  /** Applies several confirmed translations at once (one undo step) — the AI-assist "Apply". */
  applyTranslations: (locale: string, texts: Record<string, string>) => void;
  setLanguageFontScale: (locale: string, fontScale: number) => void;
}

function mapLanguage(p: Project, locale: string, fn: (l: LanguageEntry) => LanguageEntry): Project {
  const loc = p.localization;
  if (!loc) return p;
  return { ...p, localization: { ...loc, languages: loc.languages.map((l) => (l.locale === locale ? fn(l) : l)) } };
}

/** Current source text of a string key ('' if the string no longer exists). */
function sourceText(p: Project, key: string): string {
  return collectStrings(p).find((s) => s.key === key)?.source ?? '';
}

let nextId = 1;
let commitTimer: ReturnType<typeof setTimeout> | null = null;
const history: History = { stack: [], i: -1 };

function resetHistory(project: Project) {
  if (commitTimer) {
    clearTimeout(commitTimer);
    commitTimer = null;
  }
  history.stack = [structuredClone(project)];
  history.i = 0;
}

function maxSlideId(project: Project): number {
  return project.scenes.reduce((m, s) => Math.max(m, s.id), 0);
}

function defaultSelection(project: Project): number | 'intro' | 'outro' | null {
  if (project.scenes.length) return project.scenes[0].id;
  if (project.intro.on) return 'intro';
  if (project.outro.on) return 'outro';
  return null;
}

function mapSlide(project: Project, id: number, fn: (s: Slide) => Slide): Project {
  return { ...project, scenes: project.scenes.map((s) => (s.id === id ? fn(s) : s)) };
}

function mapStorySlide(project: Project, id: number, fn: (s: StorySlide) => StorySlide): Project {
  return mapSlide(project, id, (s) => (s.kind === 'story' ? fn(s) : s));
}

function mapImageSlide(project: Project, id: number, fn: (s: ImageSlide) => ImageSlide): Project {
  return mapSlide(project, id, (s) => (s.kind === 'image' ? fn(s) : s));
}

/** Sensible starting field values for a freshly-added action of a given
 * type — the inspector lets the user tune everything from here. */
function defaultAction(type: ActionType, id: string): Action {
  const common = { id, duration: 1, startMode: 'after-previous' as const, easing: 'easeInOutCubic' as const, sfx: '' };
  switch (type) {
    case 'launchApp':
      return { ...common, type, duration: 1.3, wallpaper: { kind: 'color', color: '#1F2A44' }, iconPosition: { x: 0.5, y: 0.42 } };
    case 'showScreen':
      return { ...common, type, duration: 0.6, screenId: '', transition: 'fade' };
    case 'loading':
      return { ...common, type, duration: 1.0, style: 'spinner' };
    case 'scroll':
      return { ...common, type, duration: 1.2, from: 0, to: 0.6, overshoot: true };
    case 'tap':
      return { ...common, type, duration: 0.8, x: 0.5, y: 0.5, press: 'both' };
    case 'longPress':
      return { ...common, type, duration: 1.0, x: 0.5, y: 0.5 };
    case 'swipe':
      return { ...common, type, duration: 0.8, from: { x: 0.5, y: 0.7 }, to: { x: 0.5, y: 0.3 } };
    case 'typeText':
      return { ...common, type, duration: 1.2, x: 0.1, y: 0.5, width: 0.8, text: 'Hello', charsPerSecond: 12 };
    case 'highlight':
      return { ...common, type, duration: 1.2, x: 0.2, y: 0.3, w: 0.6, h: 0.15 };
    case 'notification':
      return { ...common, type, duration: 2.2, title: 'App', body: 'New notification' };
    case 'iconAnim':
      return { ...common, type, duration: 1.0, x: 0.5, y: 0.1, builtIn: 'bell', anim: 'ring' };
    case 'sprite':
      return { ...common, type, duration: 2.0, spriteId: '' };
    case 'successCheck':
      return { ...common, type, duration: 1.0, x: 0.5, y: 0.5 };
    case 'wait':
      return { ...common, type, duration: 0.6 };
    default: {
      const never: never = type;
      throw new Error(`unknown action type: ${never}`);
    }
  }
}

function withStyle(style: SlideStyle, key: keyof SlideStyle, value: string | undefined): SlideStyle {
  const next = { ...style };
  if (value === undefined || value === '') delete next[key];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SlideStyle's keys are individually typed unions; this setter is generic over all of them.
  else (next as any)[key] = value;
  return next;
}

export const useEditorStore = create<EditorState>((set, get) => {
  const initialProject = createDefaultProject();
  resetHistory(initialProject);

  /** Schedules a debounced history commit; call after every mutation. */
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
    // undo()/redo() call this unconditionally to flush any pending
    // debounced edit before navigating history. When there's nothing
    // pending (the debounce already fired, or commitNow() is called with
    // no changes since), skip pushing — otherwise this duplicates the
    // current state onto the stack and undo()'s subsequent step-back lands
    // right back on an identical snapshot, silently eating the user's
    // first Undo click.
    if (!hadPendingEdit && JSON.stringify(history.stack[history.i]) === JSON.stringify(project)) return;
    history.stack = history.stack.slice(0, history.i + 1);
    history.stack.push(structuredClone(project));
    if (history.stack.length > HISTORY_LIMIT) history.stack.shift();
    history.i = history.stack.length - 1;
    set({ canUndo: history.i > 0, canRedo: history.i < history.stack.length - 1 });
  }

  /** Applies an update to `project` and schedules a history commit. */
  function update(fn: (project: Project) => Project) {
    set((s) => ({ project: fn(s.project) }));
    scheduleCommit();
  }

  return {
    project: initialProject,
    assets: { images: {}, audio: {} },
    canUndo: false,
    canRedo: false,
    projectId: null,
    plan: 'free',
    setPlan: (plan) => set({ plan }),

    previewLocale: null,
    setPreviewLocale: (previewLocale) => set({ previewLocale }),
    enableLocalization: (source) =>
      update((p) => (p.localization ? p : { ...p, localization: { source, languages: [{ locale: source, fontScale: 1, strings: {} }] } })),
    setSourceLocale: (locale) =>
      update((p) => {
        const loc = p.localization;
        if (!loc || loc.languages.length > 1) return p;
        return { ...p, localization: { source: locale, languages: [{ ...loc.languages[0], locale }] } };
      }),
    addLanguage: (locale) => {
      const { project, plan } = get();
      const langs = project.localization?.languages ?? [];
      if (langs.some((l) => l.locale === locale)) return true;
      if (Math.max(1, langs.length) + 1 > PLAN_LIMITS[plan].maxLanguages) return false;
      update((p) => {
        const loc = p.localization ?? { source: 'en', languages: [{ locale: 'en', fontScale: 1, strings: {} }] };
        return { ...p, localization: { ...loc, languages: [...loc.languages, newLanguageEntry(p, locale)] } };
      });
      return true;
    },
    removeLanguage: (locale) => {
      update((p) => {
        const loc = p.localization;
        if (!loc || locale === loc.source) return p;
        return { ...p, localization: { ...loc, languages: loc.languages.filter((l) => l.locale !== locale) } };
      });
      if (get().previewLocale === locale) set({ previewLocale: null });
    },
    setTranslation: (locale, key, text) =>
      update((p) => mapLanguage(p, locale, (l) => ({ ...l, strings: { ...l.strings, [key]: { text, sourceHash: hashText(sourceText(p, key)), done: true } } }))),
    setTranslationDone: (locale, key, done) =>
      update((p) =>
        mapLanguage(p, locale, (l) => {
          const cur = l.strings[key] ?? { text: sourceText(p, key), sourceHash: '', done: false };
          return { ...l, strings: { ...l.strings, [key]: { ...cur, done, sourceHash: hashText(sourceText(p, key)) } } };
        }),
      ),
    applyTranslations: (locale, texts) =>
      update((p) =>
        mapLanguage(p, locale, (l) => {
          const strings = { ...l.strings };
          for (const [key, text] of Object.entries(texts)) strings[key] = { text, sourceHash: hashText(sourceText(p, key)), done: true };
          return { ...l, strings };
        }),
      ),
    setLanguageFontScale: (locale, fontScale) => update((p) => mapLanguage(p, locale, (l) => ({ ...l, fontScale }))),

    selectedSceneId: defaultSelection(initialProject),
    selectScene: (id) => set({ selectedSceneId: id }),

    loadProject: (project, projectId, assets) => {
      const normalized = normalizeProject(project);
      nextId = maxSlideId(normalized) + 1;
      resetHistory(normalized);
      set(() => ({
        project: normalized,
        projectId,
        assets: { images: { ...(assets?.images ?? {}) }, audio: { ...(assets?.audio ?? {}) } },
        canUndo: false,
        canRedo: false,
        selectedSceneId: defaultSelection(normalized),
        previewLocale: null,
      }));
    },

    setFormat: (format) => update((p) => ({ ...p, format })),
    setQuality: (quality) => update((p) => ({ ...p, quality })),
    setAppName: (appName) => update((p) => ({ ...p, appName })),
    setFont: (font) => update((p) => ({ ...p, font })),
    setPreset: (index) => {
      const preset = PRESETS[index];
      update((p) => ({ ...p, preset: index, colors: preset ? { ...preset } : p.colors }));
    },
    setColors: (colors) => update((p) => ({ ...p, preset: -1, colors: { ...p.colors, ...colors } })),
    setModel: (model) => update((p) => ({ ...p, model })),
    setFcolor: (fcolor) => update((p) => ({ ...p, fcolor })),
    setBgPattern: (bgPattern) => update((p) => ({ ...p, bgPattern })),
    setShapes: (shapes) => update((p) => ({ ...p, shapes })),
    setGrain: (grain) => update((p) => ({ ...p, grain })),
    setVignette: (vignette) => update((p) => ({ ...p, vignette })),
    setStoryBars: (storyBars) => update((p) => ({ ...p, storyBars })),
    setHlStyle: (hlStyle) => update((p) => ({ ...p, hlStyle })),
    setTextPos: (textPos) => update((p) => ({ ...p, textPos })),
    setTextAnim: (textAnim) => update((p) => ({ ...p, textAnim })),
    setTransition: (transition) => update((p) => ({ ...p, transition })),
    setMotionSpeed: (motionSpeed) => update((p) => ({ ...p, motionSpeed })),

    setIntro: (patch) => update((p) => ({ ...p, intro: { ...p.intro, ...patch } })),
    setIntroStyle: (key, value) => update((p) => ({ ...p, intro: { ...p.intro, style: withStyle(p.intro.style, key, value) } })),
    resetIntroStyle: () => update((p) => ({ ...p, intro: { ...p.intro, style: {} } })),
    setOutro: (patch) => update((p) => ({ ...p, outro: { ...p.outro, ...patch } })),
    setOutroStyle: (key, value) => update((p) => ({ ...p, outro: { ...p.outro, style: withStyle(p.outro.style, key, value) } })),
    resetOutroStyle: () => update((p) => ({ ...p, outro: { ...p.outro, style: {} } })),

    setIcon: (assetId, image) => {
      set((s) => ({ assets: { ...s.assets, images: { ...s.assets.images, [assetId]: image } } }));
      update((p) => ({ ...p, iconAssetId: assetId }));
    },
    clearIcon: () => update((p) => ({ ...p, iconAssetId: null })),
    setMusic: (assetId, name, buffer, bpm) => {
      set((s) => ({ assets: { ...s.assets, audio: { ...s.assets.audio, [assetId]: buffer } } }));
      update((p) => ({ ...p, music: { assetId, name, bpm } }));
    },
    clearMusic: () => update((p) => ({ ...p, music: null })),
    setVolume: (volume) => update((p) => ({ ...p, volume })),
    setDucking: (ducking) => update((p) => ({ ...p, ducking })),

    registerImage: (assetId, image) => {
      set((s) => ({ assets: { ...s.assets, images: { ...s.assets.images, [assetId]: image } } }));
    },
    addImageSlide: (assetId, overrides) => {
      const id = nextId++;
      update((p) => ({ ...p, scenes: [...p.scenes, createImageSlide(id, assetId, overrides)] }));
      set({ selectedSceneId: id });
      return String(id);
    },
    addTextSlide: (overrides) => {
      const id = nextId++;
      update((p) => ({ ...p, scenes: [...p.scenes, createTextSlide(id, overrides)] }));
      set({ selectedSceneId: id });
      return String(id);
    },
    addStorySlide: () => {
      const id = nextId++;
      const slide: StorySlide = { kind: 'story', id, style: {}, screens: [], actions: [], sprites: [], cameraMode: 'auto', cameraKeys: [], hidden: false };
      update((p) => ({ ...p, scenes: [...p.scenes, slide] }));
      set({ selectedSceneId: id });
      return String(id);
    },
    updateSlide: (id, patch) => update((p) => mapSlide(p, id, (s) => ({ ...s, ...patch }) as Slide)),
    replaceSlideImage: (id, assetId, image) => {
      set((s) => ({ assets: { ...s.assets, images: { ...s.assets.images, [assetId]: image } } }));
      update((p) => mapSlide(p, id, (s) => (s.kind === 'image' ? { ...s, imgAssetId: assetId } : s)));
    },
    removeSlide: (id) => {
      const scenesBefore = get().project.scenes;
      const i = scenesBefore.findIndex((s) => s.id === id);
      update((p) => ({ ...p, scenes: p.scenes.filter((s) => s.id !== id) }));
      if (get().selectedSceneId === id) {
        const prev = scenesBefore[i - 1];
        set({ selectedSceneId: prev ? prev.id : defaultSelection(get().project) });
      }
    },
    duplicateSlide: (id) => {
      const newId = nextId++;
      update((p) => {
        const i = p.scenes.findIndex((s) => s.id === id);
        if (i < 0) return p;
        const copy: Slide = { ...structuredClone(p.scenes[i]), id: newId };
        const scenes = [...p.scenes];
        scenes.splice(i + 1, 0, copy);
        return { ...p, scenes };
      });
      set({ selectedSceneId: newId });
    },
    moveSlide: (id, dir) =>
      update((p) => {
        const i = p.scenes.findIndex((s) => s.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= p.scenes.length) return p;
        const scenes = [...p.scenes];
        [scenes[i], scenes[j]] = [scenes[j], scenes[i]];
        return { ...p, scenes };
      }),
    setElementXforms: (owner, patch) => update((p) => setXforms(p, owner, patch)),
    setElementText: (owner, key, text) => update((p) => setTextOf(p, owner, key, text)),
    deleteElements: (owner, keys) => update((p) => keys.reduce((acc, k) => deleteElement(acc, owner, k), p)),
    addTextLayer: (owner, layer, xf) => update((p) => addTextLayer(p, owner, layer, xf)),
    setElementStackOrder: (owner, keys) => update((p) => setStackOrder(p, owner, keys)),
    moveSlideBefore: (id, beforeId) =>
      update((p) => {
        const moving = p.scenes.find((s) => s.id === id);
        if (!moving || id === beforeId) return p;
        const rest = p.scenes.filter((s) => s.id !== id);
        const at = beforeId === null ? rest.length : rest.findIndex((s) => s.id === beforeId);
        if (at < 0) return p;
        const scenes = [...rest.slice(0, at), moving, ...rest.slice(at)];
        return scenes.every((s, i) => s === p.scenes[i]) ? p : { ...p, scenes };
      }),
    setSlideStyle: (id, key, value) => update((p) => mapSlide(p, id, (s) => ({ ...s, style: withStyle(s.style, key, value) }))),
    resetSlideStyle: (id) => update((p) => mapSlide(p, id, (s) => ({ ...s, style: {} }))),
    applyStyleToAll: (id) =>
      update((p) => {
        const src = p.scenes.find((s) => s.id === id);
        if (!src) return p;
        return {
          ...p,
          scenes: p.scenes.map((s) => {
            if (s.id === id) return s;
            const style = { ...src.style };
            if (s.kind === 'text') {
              delete style.textPos;
              delete style.model;
              delete style.fcolor;
            }
            return { ...s, style };
          }),
        };
      }),

    addCutout: (slideId, rect) => {
      const id = newAssetId('cut');
      const cutout: CutoutLayer = { id, rect, radius: 0.08, preset: 'liftOut', hollow: true, at: 0.6, stackIndex: 0 };
      update((p) => mapImageSlide(p, slideId, (s) => ({ ...s, cutouts: [...s.cutouts, cutout] })));
      return id;
    },
    updateCutout: (slideId, cutoutId, patch) =>
      update((p) => mapImageSlide(p, slideId, (s) => ({ ...s, cutouts: s.cutouts.map((c) => (c.id === cutoutId ? { ...c, ...patch } : c)) }))),
    removeCutout: (slideId, cutoutId) => update((p) => mapImageSlide(p, slideId, (s) => ({ ...s, cutouts: s.cutouts.filter((c) => c.id !== cutoutId) }))),

    addStoryScreen: (slideId, assetId) => {
      const id = newAssetId('scr');
      update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, screens: [...s.screens, { id, assetId }] })));
      return id;
    },
    setStoryScreenAsset: (slideId, screenId, assetId) =>
      update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, screens: s.screens.map((sc) => (sc.id === screenId ? { ...sc, assetId } : sc)) }))),
    removeStoryScreen: (slideId, screenId) => update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, screens: s.screens.filter((sc) => sc.id !== screenId) }))),
    moveStoryScreen: (slideId, screenId, dir) =>
      update((p) =>
        mapStorySlide(p, slideId, (s) => {
          const i = s.screens.findIndex((sc) => sc.id === screenId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.screens.length) return s;
          const screens = [...s.screens];
          [screens[i], screens[j]] = [screens[j], screens[i]];
          return { ...s, screens };
        }),
      ),

    addStoryAction: (slideId, type) => {
      const action = defaultAction(type, newAssetId('act'));
      update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, actions: [...s.actions, action] })));
      return action.id;
    },
    updateStoryAction: (slideId, actionId, patch) =>
      update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, actions: s.actions.map((a) => (a.id === actionId ? ({ ...a, ...patch } as Action) : a)) }))),
    removeStoryAction: (slideId, actionId) => update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, actions: s.actions.filter((a) => a.id !== actionId) }))),
    moveStoryAction: (slideId, actionId, dir) =>
      update((p) =>
        mapStorySlide(p, slideId, (s) => {
          const i = s.actions.findIndex((a) => a.id === actionId);
          const j = i + dir;
          if (i < 0 || j < 0 || j >= s.actions.length) return s;
          const actions = [...s.actions];
          [actions[i], actions[j]] = [actions[j], actions[i]];
          return { ...s, actions };
        }),
      ),
    reorderStoryActions: (slideId, fromIndex, toIndex) =>
      update((p) =>
        mapStorySlide(p, slideId, (s) => {
          if (fromIndex < 0 || fromIndex >= s.actions.length || toIndex < 0 || toIndex >= s.actions.length || fromIndex === toIndex) return s;
          const actions = [...s.actions];
          const [moved] = actions.splice(fromIndex, 1);
          actions.splice(toIndex, 0, moved);
          return { ...s, actions };
        }),
      ),

    setCameraMode: (slideId, mode) => update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, cameraMode: mode }))),
    addCameraKey: (slideId, key) => update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, cameraKeys: [...s.cameraKeys, key] }))),
    updateCameraKey: (slideId, index, key) => update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, cameraKeys: s.cameraKeys.map((k, i) => (i === index ? key : k)) }))),
    removeCameraKey: (slideId, index) => update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, cameraKeys: s.cameraKeys.filter((_, i) => i !== index) }))),

    addSprite: (slideId) => {
      const sprite: Sprite = { id: newAssetId('spr'), source: { kind: 'builtin', name: 'pin' }, path: [{ x: 0.2, y: 0.8 }, { x: 0.8, y: 0.2 }], size: 0.12, rotateAlongPath: false, easing: 'easeInOutCubic' };
      update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, sprites: [...s.sprites, sprite] })));
      return sprite.id;
    },
    updateSprite: (slideId, spriteId, patch) =>
      update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, sprites: s.sprites.map((sp) => (sp.id === spriteId ? { ...sp, ...patch } : sp)) }))),
    removeSprite: (slideId, spriteId) => update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, sprites: s.sprites.filter((sp) => sp.id !== spriteId) }))),
    addSpritePathPoint: (slideId, spriteId, point) =>
      update((p) => mapStorySlide(p, slideId, (s) => ({ ...s, sprites: s.sprites.map((sp) => (sp.id === spriteId ? { ...sp, path: [...sp.path, point] } : sp)) }))),
    updateSpritePathPoint: (slideId, spriteId, index, point) =>
      update((p) =>
        mapStorySlide(p, slideId, (s) => ({
          ...s,
          sprites: s.sprites.map((sp) => (sp.id === spriteId ? { ...sp, path: sp.path.map((pt, i) => (i === index ? point : pt)) } : sp)),
        })),
      ),
    removeSpritePathPoint: (slideId, spriteId, index) =>
      update((p) =>
        mapStorySlide(p, slideId, (s) => ({
          ...s,
          sprites: s.sprites.map((sp) => (sp.id === spriteId ? { ...sp, path: sp.path.filter((_, i) => i !== index) } : sp)),
        })),
      ),

    commitNow: () => commitNowImpl(),
    undo: () => {
      commitNowImpl();
      if (history.i <= 0) return;
      history.i--;
      const snap = structuredClone(history.stack[history.i]);
      nextId = maxSlideId(snap) + 1;
      set({ project: snap, canUndo: history.i > 0, canRedo: history.i < history.stack.length - 1 });
    },
    redo: () => {
      if (history.i >= history.stack.length - 1) return;
      history.i++;
      const snap = structuredClone(history.stack[history.i]);
      nextId = maxSlideId(snap) + 1;
      set({ project: snap, canUndo: history.i > 0, canRedo: history.i < history.stack.length - 1 });
    },
  };
});
