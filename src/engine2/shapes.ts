/**
 * 'shape' layer renderer — plain vector primitives (rect/roundrect/circle/
 * ellipse/ring), palette-colored, distinct from 'ui-element' (which draws
 * arbitrary hand-built UI chrome via the recipe registry). Drawn to a
 * canvas like everything else (texture.ts's makeCanvas/textureFromCanvas)
 * so it goes through the same PlaneGeometry + CanvasTexture pipeline.
 */
import { roundRectPath } from './texture';
import type { Palette } from './palettes';
import type { ShapeProps } from './types';

function colorFor(key: ShapeProps['fill'] | ShapeProps['stroke'], palette: Palette): string | null {
  if (!key || key === 'none') return null;
  return palette[key];
}

export function drawShape(ctx: CanvasRenderingContext2D, w: number, h: number, props: ShapeProps, palette: Palette): void {
  const fill = colorFor(props.fill ?? 'ui', palette);
  const stroke = colorFor(props.stroke, palette);
  const strokeWidth = props.strokeWidth ?? 0;
  const inset = strokeWidth / 2;

  ctx.beginPath();
  switch (props.shape) {
    case 'rect':
      ctx.rect(inset, inset, w - strokeWidth, h - strokeWidth);
      break;
    case 'roundrect':
      roundRectPath(ctx, inset, inset, w - strokeWidth, h - strokeWidth, props.cornerRadius ?? Math.min(w, h) * 0.12);
      break;
    case 'circle': {
      const r = Math.min(w, h) / 2 - inset;
      ctx.arc(w / 2, h / 2, Math.max(0, r), 0, Math.PI * 2);
      break;
    }
    case 'ellipse':
      ctx.ellipse(w / 2, h / 2, Math.max(0, w / 2 - inset), Math.max(0, h / 2 - inset), 0, 0, Math.PI * 2);
      break;
    case 'ring': {
      const rOuter = Math.max(0, Math.min(w, h) / 2 - inset);
      const rInner = Math.max(0, rOuter * (1 - (props.ringThickness ?? 0.28)));
      ctx.arc(w / 2, h / 2, rOuter, 0, Math.PI * 2);
      ctx.moveTo(w / 2 + rInner, h / 2);
      ctx.arc(w / 2, h / 2, rInner, 0, Math.PI * 2, true);
      break;
    }
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
  }
  if (stroke && strokeWidth > 0) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}
