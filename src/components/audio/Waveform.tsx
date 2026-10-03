/** Bar waveform from 0–1 peaks; `progress` (0–1) colours the played part. */
export default function Waveform({ peaks, progress = 0, height = 28, className = '', played = '#8b7dff', rest = 'rgba(255,255,255,.28)' }: { peaks: number[]; progress?: number; height?: number; className?: string; played?: string; rest?: string }) {
  if (!peaks.length) return null;
  const w = peaks.length * 3;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className={className} style={{ height }} aria-hidden>
      {peaks.map((p, i) => {
        const h = Math.max(1.5, p * height);
        return <rect key={i} x={i * 3} y={(height - h) / 2} width={2} height={h} rx={1} fill={i / peaks.length < progress ? played : rest} />;
      })}
    </svg>
  );
}
