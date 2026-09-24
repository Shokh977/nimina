import { FORMATS } from '../constants';
import type { Project } from '../types';
import type { ExportResolution } from './types';

/** FORMATS' base w/h (e.g. 1080x1920 for 9:16) are already "1080p"-scale, so
 * every other resolution is a multiple of that. */
const SCALE: Record<ExportResolution, number> = {
  '720p': 720 / 1080,
  '1080p': 1,
  '4k': 2160 / 1080,
};

/** Pixel dimensions (rounded to even numbers, required for 4:2:0 chroma
 * subsampling) and the `render()` scale factor for a format/resolution pair. */
export function outputDimensions(project: Project, resolution: ExportResolution): { width: number; height: number; scale: number } {
  const fmt = FORMATS[project.format];
  const scale = SCALE[resolution];
  const width = Math.round((fmt.w * scale) / 2) * 2;
  const height = Math.round((fmt.h * scale) / 2) * 2;
  return { width, height, scale };
}

export function qualityToResolution(quality: Project['quality']): ExportResolution {
  if (quality === '720') return '720p';
  if (quality === '2160') return '4k';
  return '1080p';
}

export function resolutionToQuality(resolution: ExportResolution): Project['quality'] {
  if (resolution === '720p') return '720';
  if (resolution === '4k') return '2160';
  return '1080';
}
