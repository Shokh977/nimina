'use client';

export interface SwatchItem {
  id: string;
  /** Any valid CSS `background` value — a solid color or a gradient. */
  background: string;
  label: string;
}

/** Wrapping row of color/gradient swatches — used for accent colors, frame
 * colors, and per-slide background presets. Selected: 2px white ring plus
 * a 3px indigo halo; unselected: 2px translucent white ring. */
export default function SwatchGrid({ items, value, onChange, size = 38, shape = 'circle' }: { items: SwatchItem[]; value: string; onChange: (id: string) => void; size?: number; shape?: 'circle' | 'rounded' }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-pressed={selected}
            onClick={() => onChange(item.id)}
            style={{
              width: size,
              height: size,
              background: item.background,
              boxShadow: selected ? '0 0 0 2px #fff, 0 0 0 5px rgba(139,125,255,.45)' : '0 0 0 2px rgba(255,255,255,.14)',
            }}
            className={`shrink-0 transition-[box-shadow] duration-[.16s] ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'}`}
          />
        );
      })}
    </div>
  );
}
