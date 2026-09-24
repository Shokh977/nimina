/**
 * Animated UI element kit (Prompt 4). Each element in ui-kit/elements/*.ts
 * self-registers into registry.ts on import — importing this module (for
 * its side effects) is what populates listElements(). See theme.ts for how
 * a project Palette becomes a UIKitTheme, paletteExtractor.ts for proposing
 * one from a screenshot, and liveTexture.ts for wrapping a running element
 * as a THREE.CanvasTexture usable as any other engine2 layer content.
 */
import './elements/card';
import './elements/charts';
import './elements/controls';
import './elements/messaging';
import './elements/notification';
import './elements/pointer';
import './elements/reaction';
import './elements/searchBar';
import './elements/status';

export { deriveTheme, type UIKitTheme } from './theme';
export { extractPalette, type ExtractedTheme } from './paletteExtractor';
export { createUIElementTexture, type UIElementTextureHandle } from './liveTexture';
export { getElement, listElements } from './registry';
export type { AnyProps, PropField, UIElementDef } from './types';
