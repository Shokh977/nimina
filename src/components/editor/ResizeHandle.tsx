'use client';

import { useRef } from 'react';

/** A thin drag handle sitting on a column border. `onDrag` receives the
 * raw horizontal pointer delta since the drag started (in px, left-to-right
 * positive) on every move — the caller decides what that means for its own
 * column (grow vs shrink) and applies its own min/max clamp. Widens its
 * hit area beyond the visible line so it's easy to grab without needing
 * pixel-perfect aim. */
export default function ResizeHandle({ onDragStart, onDrag, label }: { onDragStart: () => void; onDrag: (deltaX: number) => void; label: string }) {
  const startXRef = useRef(0);
  const draggingRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    draggingRef.current = true;
    onDragStart();
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    onDrag(e.clientX - startXRef.current);
  };
  const onPointerUp = () => {
    draggingRef.current = false;
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      className="group relative w-0 shrink-0 cursor-col-resize touch-none select-none"
    >
      <div className="absolute inset-y-0 -left-[3px] w-[7px]" />
      <div className="absolute inset-y-0 left-0 w-px bg-white/[.07] transition-colors duration-[.16s] group-hover:bg-[#8b7dff] group-active:bg-[#8b7dff]" />
    </div>
  );
}
