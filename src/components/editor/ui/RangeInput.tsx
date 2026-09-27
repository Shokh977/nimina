'use client';

const TRACK = 'appearance-none [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/[.12] [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/[.12]';
const THUMB =
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#5b4bff] [&::-webkit-slider-thumb]:shadow-[0_0_0_2px_#0c0e14] [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#5b4bff] [&::-moz-range-thumb]:shadow-[0_0_0_2px_#0c0e14]';

/** Custom-styled range input — 4px radius-999px translucent track, 16px
 * indigo thumb with a dark ring, value readout in Space Grotesk on the
 * right of the label. Used for Motion speed and the music volume slider. */
export default function RangeInput({
  min,
  max,
  step,
  value,
  onChange,
  label,
  valueLabel,
}: {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  label?: React.ReactNode;
  valueLabel?: React.ReactNode;
}) {
  return (
    <div>
      {(label || valueLabel) && (
        <div className="mb-[9px] flex items-center justify-between">
          {label && <span className="text-[12.5px] font-semibold text-[#c9cdd8]">{label}</span>}
          {valueLabel != null && <span className="font-[family-name:var(--font-space-grotesk)] text-[13px] font-semibold text-[#cfc8ff]">{valueLabel}</span>}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-4 w-full cursor-pointer bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${TRACK} ${THUMB}`}
      />
    </div>
  );
}
