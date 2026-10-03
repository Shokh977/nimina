/**
 * Factory for a brand-new, empty Project — the engine-level defaults a new
 * project starts from (mirrors legacy/promo-studio.html's initial `state`
 * object, minus its baked-in demo content).
 */
import { migrateLegacyAudio } from './audio/clips';
import { PRESETS } from './constants';
import type { Project } from './types';

/** Every image asset id a project's scenes reference — the intro/outro
 * icon, each image scene's screenshot, and every story slide's screens/
 * sprites/action icons. Shared by every place that needs to resolve real
 * uploaded assets for a project: the editor's own hydration
 * (usePersistence.ts, useTemplatePersistence.ts) and the admin template
 * preview regenerator (TemplatePreviewRegenerator.tsx). */
export function collectImageAssetIds(project: Project): Set<string> {
  const ids = new Set<string>();
  project.scenes.forEach((s) => {
    if (s.kind === 'image' && s.imgAssetId) ids.add(s.imgAssetId);
    if (s.kind === 'story') {
      s.screens.forEach((screen) => ids.add(screen.assetId));
      s.actions.forEach((a) => {
        if (a.type === 'launchApp' && a.iconAssetId) ids.add(a.iconAssetId);
        if (a.type === 'loading' && a.logoAssetId) ids.add(a.logoAssetId);
        if (a.type === 'notification' && a.iconAssetId) ids.add(a.iconAssetId);
      });
      s.sprites.forEach((sp) => {
        if (sp.source.kind === 'asset') ids.add(sp.source.assetId);
      });
    }
  });
  if (project.iconAssetId) ids.add(project.iconAssetId);
  return ids;
}

export function createDefaultProject(): Project {
  return {
    format: '9:16',
    preset: 0,
    colors: { ...PRESETS[0] },
    font: 0,
    model: 'island',
    fcolor: 'graphite',
    bgPattern: 'glow',
    shapes: true,
    grain: false,
    vignette: false,
    storyBars: false,
    hlStyle: 'marker',
    textPos: 'top',
    textAnim: 'rise',
    transition: 'wipe',
    appName: '',
    intro: { on: true, dur: 2.5, tagline: '', style: {} },
    iconAssetId: null,
    outro: { on: true, dur: 3, cta: '', button: 'Download free', small: '', style: {} },
    scenes: [],
    quality: '1080',
    ducking: true,
    motionSpeed: 100,
  };
}

/** Backfills fields added after a project may have been saved — `hidden`
 * on scenes, `motionSpeed` on the project, the audio tracks that replaced
 * the single `music` field — so the store's "Project is
 * always fully populated once loaded" invariant holds for every consumer,
 * without scattering `?? false`/`?? 100` fallbacks across the engine. Call
 * once at every load boundary (editorStore's loadProject, and wherever a
 * template/project is first hydrated server-side). */
export function normalizeProject(p: Project): Project {
  return {
    ...migrateLegacyAudio(p),
    motionSpeed: p.motionSpeed ?? 100,
    scenes: p.scenes.map((s) => ({ ...s, hidden: s.hidden ?? false })),
  };
}
