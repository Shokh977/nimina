import Link from 'next/link';

export default function CtaBanner() {
  return (
    <section className="mx-auto max-w-[1100px] px-4 pb-20 sm:px-6">
      <div className="rounded-3xl bg-[#1B1E26] px-6 py-14 text-center text-[#E8EAF0]">
        <h2 className="font-[family-name:var(--font-bricolage)] text-[28px] font-extrabold tracking-tight sm:text-[34px]">Ready to make your promo video?</h2>
        <p className="mx-auto mt-3 max-w-[440px] text-[15px] text-white/70">Start free — no credit card required.</p>
        <Link href="/login" className="mt-6 inline-block rounded-xl bg-indigo-500 px-6 py-3 text-[15px] font-bold text-white">
          Start free
        </Link>
      </div>
    </section>
  );
}
