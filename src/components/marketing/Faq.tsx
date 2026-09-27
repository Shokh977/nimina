const FAQS: Array<[string, string]> = [
  ['Do I need design or video-editing skills?', 'No. Pick a device frame and a look, drop in your screenshots, write your headlines, and Nimina handles the framing, animation and timing.'],
  ['What formats can I export?', 'Vertical 9:16 (Shorts, Reels, TikTok), square 1:1 (feed posts), and widescreen 16:9 (YouTube, websites) — all exported as MP4.'],
  ['What’s the difference between Free and Pro?', 'Free includes 1 saved project, exports up to 720p, and a small watermark. Pro removes the watermark, unlocks up to 4K export, unlimited projects, and every device and effect. See the pricing page for the full list.'],
  ['Which browsers work best for exporting?', 'Recent versions of Chrome, Edge and Safari export fastest. Other browsers fall back to a slower real-time recording automatically — you don’t need to do anything differently.'],
  ['Can I cancel anytime?', 'Yes — manage or cancel your subscription anytime from your account menu.'],
  ['Are my screenshots and projects private?', 'Yes, your uploads and projects are private to your account.'],
];

export default function Faq() {
  return (
    <section className="mx-auto max-w-[760px] px-4 py-16 sm:px-6">
      <h2 className="text-center font-[family-name:var(--font-bricolage)] text-[28px] font-extrabold tracking-tight sm:text-[34px]">Frequently asked questions</h2>
      <div className="mt-8 space-y-2">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group rounded-2xl border border-black/10 px-5 py-4 dark:border-white/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:content-none">
              {q}
              <span className="flex-none text-neutral-400 transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2.5 text-[14.5px] text-neutral-600 dark:text-neutral-300">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
