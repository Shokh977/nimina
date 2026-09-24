/**
 * The shape every UI kit element is defined against. `propsSchema` is what
 * makes "everything editable in the inspector" possible without a bespoke
 * form per element — a generic panel (the gallery's own controls today,
 * a real Manual-level inspector later) reads it and renders the right
 * control per field, keyed to `props[field.key]`.
 */
import type { UIKitTheme } from './theme';

export type PropField =
  | { key: string; kind: 'string'; label: string; maxLength?: number }
  | { key: string; kind: 'number'; label: string; min: number; max: number; step: number }
  | { key: string; kind: 'boolean'; label: string }
  | { key: string; kind: 'color'; label: string }
  | { key: string; kind: 'emoji'; label: string }
  | { key: string; kind: 'select'; label: string; options: Array<{ value: string; label: string }> };

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a heterogeneous registry of elements each with their own props shape needs a common ground type; every real usage site is generic over a specific P.
export type AnyProps = Record<string, any>;

export interface UIElementDef<P extends AnyProps = AnyProps> {
  id: string;
  label: string;
  /** Which src/engine2/ui-kit/elements/*.ts group this belongs to, for the
   * gallery's section headers. */
  category: string;
  defaultProps: P;
  propsSchema: PropField[];
  /** Reference aspect the element is designed at — the gallery/live-texture
   * wrapper sizes the canvas to this (scaled), not necessarily what it's
   * finally displayed at. */
  naturalSize: { w: number; h: number };
  /** Pure function of time — draws one frame at `t` seconds since this
   * instance started playing. Loops that should idle forever (typing dots,
   * shimmer, spinners) use `t % period` internally; one-shot entrances
   * settle and hold past their spring's duration, matching every other
   * evaluate-at-any-t function in this engine. */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, props: P, theme: UIKitTheme): void;
}
