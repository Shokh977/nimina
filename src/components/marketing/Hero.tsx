import Link from 'next/link';

export default function Hero() {
  return (
    <section className="mx-auto max-w-[1100px] px-4 pt-14 pb-8 text-center sm:px-6 sm:pt-20">
      <h1 className="mx-auto max-w-[820px] font-[family-name:var(--font-bricolage)] text-[36px] leading-[1.08] font-extrabold tracking-tight sm:text-[52px]">
        Turn your app screenshots into a promo video in minutes
      </h1>
      <p className="mx-auto mt-5 max-w-[560px] text-[16px] text-neutral-600 sm:text-[18px] dark:text-neutral-300">
        Drop in a few screenshots. Nimina frames them in real devices, animates the text, and exports a polished MP4 — no editing software, no design skills.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link href="/login?mode=signup" className="rounded-xl bg-indigo-600 px-6 py-3 text-[15px] font-bold text-white">
          Start free
        </Link>
        <Link href="/pricing" className="rounded-xl border border-black/10 px-6 py-3 text-[15px] font-bold dark:border-white/15">
          See pricing
        </Link>
      </div>
      <p className="mt-3 text-[12.5px] text-neutral-500 dark:text-neutral-400">Free plan available. No credit card required to start.</p>
    </section>
  );
}
