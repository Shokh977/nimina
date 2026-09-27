'use client';

import type { ImageAsset } from '@/engine/types';
import { assetSrc } from '@/lib/assetSrc';

export interface PlacementPoint {
 x: number;
 y: number;
 color: string;
 label?: string;
}
export interface PlacementRect {
 x: number;
 y: number;
 w: number;
 h: number;
 color: string;
}

/**
 * Click-anywhere-on-the-screenshot position picker, the story-slide
 * equivalent of SceneCard's classic focus-point picker. Positions are
 * normalized 0-1 relative to the *full* screenshot image (matching every
 * story action's x/y fields), so the whole image is shown uncropped rather
 * than the cover-fit/scrolled device screen box.
 */
export default function ScreenPlacementPicker({
 image,
 points = [],
 rect,
 onPick,
 emptyLabel = 'No screen to preview — add one below',
}: {
 image: ImageAsset | null;
 points?: PlacementPoint[];
 rect?: PlacementRect;
 onPick?: (x: number, y: number) => void;
 emptyLabel?: string;
}) {
 const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
 if (!onPick) return;
 const r = e.currentTarget.getBoundingClientRect();
 const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
 const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
 onPick(x, y);
 };

 return (
 <div
 onClick={handleClick}
 className={`relative w-full max-w-[200px] overflow-hidden rounded-xl bg-black ${onPick ? 'cursor-crosshair' : ''}`}
 >
 {image ? (
 // eslint-disable-next-line @next/next/no-img-element -- in-memory/data-URL asset
 <img src={assetSrc(image)} alt="" className="block w-full h-auto select-none" draggable={false} />
 ) : (
 <div className="grid h-[220px] place-items-center px-3 text-center text-[12px] text-[#767e8d]">{emptyLabel}</div>
 )}
 {rect && (
 <div
 style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%`, borderColor: rect.color }}
 className="pointer-events-none absolute rounded border-2"
 />
 )}
 {points.map((p, i) => (
 <span
 key={i}
 title={p.label}
 style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, borderColor: p.color }}
 className="pointer-events-none absolute h-[16px] w-[16px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] shadow-[0_0_0_2px_rgba(0,0,0,.45)]"
 />
 ))}
 </div>
 );
}
