/**
 * Factory for a brand-new, empty Project — the engine-level defaults a new
 * project starts from (mirrors legacy/promo-studio.html's initial `state`
 * object, minus its baked-in demo content).
 */
import { PRESETS } from './constants';
import type { Project } from './types';

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
    music: null,
    volume: 0.8,
    ducking: true,
  };
}
