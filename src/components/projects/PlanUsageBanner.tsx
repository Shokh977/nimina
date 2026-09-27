import Link from 'next/link';

export default function PlanUsageBanner() {
  return (
    <div className="mb-[30px] flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-[#8b7dff]/[.28] px-[22px] py-[18px]" style={{ background: 'radial-gradient(120% 200% at 0% 0%, rgba(91,75,255,.22), #0d0f15 62%)' }}>
      <div>
        <p className="font-[family-name:var(--font-space-grotesk)] text-[16.5px] font-semibold text-[#f4f5f8]">You&apos;re on the Free plan</p>
        <p className="mt-1 text-[14.5px] text-[#9aa1af]">1 of 1 project slot used · exports capped at 720p with a watermark.</p>
      </div>
      <div className="flex flex-wrap items-center gap-5">
        <div className="w-[200px]">
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full rounded-full" style={{ background: 'linear-gradient(90deg,#5b4bff,#ff7a59)' }} />
          </div>
          <p className="mt-1.5 text-[12.5px] text-[#767e8d]">6 projects saved in draft history</p>
        </div>
        <Link
          href="/pricing"
          className="rounded-xl bg-[#5b4bff] px-4 py-2.5 text-[14px] font-semibold whitespace-nowrap text-white shadow-[0_12px_30px_rgba(91,75,255,.4)] transition-colors hover:bg-[#6d5eff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}
