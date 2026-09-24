import { z } from 'zod';

/** Mirrors the engine's SlideAnim/Effect unions (src/engine/types.ts) — kept
 * as an explicit allowlist here rather than importing the type, since zod
 * needs runtime values to validate the model's response against, and this
 * is deliberately a narrow, reviewed subset of what a slide accepts. */
const SlideAnimEnum = z.enum(['rise', 'pop', 'slide', 'swing', 'spotlight']);
const EffectEnum = z.enum(['none', 'confetti', 'sparkles', 'stickers']);

export const SlideSuggestionSchema = z.object({
  sceneId: z.number().int(),
  headline: z.string().min(1).max(80).optional(),
  sub: z.string().max(120).optional(),
  anim: SlideAnimEnum.optional(),
  effect: EffectEnum.optional(),
  badge: z.string().max(20).optional(),
  callout: z.string().max(28).optional(),
});

export const DirectorResponseSchema = z.object({
  summary: z.string().min(1).max(400),
  slides: z.array(SlideSuggestionSchema).max(30),
});

export type SlideSuggestion = z.infer<typeof SlideSuggestionSchema>;
export type DirectorResponse = z.infer<typeof DirectorResponseSchema>;

export const DirectorRequestSchema = z.object({
  projectId: z.string().min(1),
  goal: z.string().min(1).max(300),
  screenshots: z
    .array(
      z.object({
        sceneId: z.number().int(),
        assetId: z.string().min(1),
      }),
    )
    .min(1)
    .max(12),
});

export type DirectorRequest = z.infer<typeof DirectorRequestSchema>;

/** One suggested cutout region — bounding box normalized 0-1 against the
 * *full* screenshot, same convention as CutoutLayer['rect'] (src/engine/types.ts)
 * so a client can hand it straight to addCutout()/updateCutout() with no
 * conversion. */
const ElementKindEnum = z.enum(['button', 'card', 'list-item', 'bubble']);

export const DetectedElementSchema = z.object({
  kind: ElementKindEnum,
  label: z.string().min(1).max(40),
  rect: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }),
});

export const DetectElementsResponseSchema = z.object({
  elements: z.array(DetectedElementSchema).max(20),
});

export type DetectedElement = z.infer<typeof DetectedElementSchema>;
export type DetectElementsResponse = z.infer<typeof DetectElementsResponseSchema>;

export const DetectElementsRequestSchema = z.object({
  projectId: z.string().min(1),
  sceneId: z.number().int(),
  assetId: z.string().min(1),
});

export type DetectElementsRequest = z.infer<typeof DetectElementsRequestSchema>;
