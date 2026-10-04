import Link from 'next/link';

export default function PricingSummary() {
  return (
    <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
      <h2 className="text-center font-[family-name:var(--font-bricolage)] text-[28px] font-extrabold tracking-tight sm:text-[34px]">Simple pricing</h2>
      <div className="mx-auto mt-10 grid max-w-[700px] gap-5 sm:grid-cols-2">
        <div className="rounded-3xl border border-black/10 p-6 dark:border-white/10">
          <h3 className="text-[17px] font-bold">Free</h3>
          <p className="mt-1 text-[13.5px] text-neutral-600 dark:text-neutral-400">1 project, 720p, watermarked.</p>
        </div>
        <div className="rounded-3xl border-2 border-indigo-500 p-6">
          <h3 className="text-[17px] font-bold">Pro</h3>
          <p className="mt-1 text-[13.5px] text-neutral-600 dark:text-neutral-400">Unlimited projects, up to 4K, no watermark.</p>
        </div>
      </div>
      <p className="mt-6 text-center">
        <Link href="/pricing" className="font-bold text-indigo-600 hover:underline dark:text-indigo-400">
          See full pricing details →
        </Link>
      </p>
    </section>
  );
}
