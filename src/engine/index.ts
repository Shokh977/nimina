/** Public entry point for the rendering engine. */
export * from './types';
export * from './constants';
export { render, getTimeline, resolveStyle, bgDiffers } from './render';
export { createImageSlide, createTextSlide } from './slides';
export { createDefaultProject } from './project';
