const FEATURES = [
  {
    title: 'Real device frames',
    body: 'Island and notch phones, Android, tablet, and browser mockups — pick the frame that matches your app, in any of six finishes.',
  },
  {
    title: 'A look for every slide',
    body: 'Colors, fonts, background patterns and text position apply to the whole video by default, or override any of it per slide.',
  },
  {
    title: 'Motion that sells it',
    body: 'Five text animations, five transitions, taps and swipes on the screen, confetti and sparkles — tuned per slide, not just on or off.',
  },
  {
    title: 'Fast MP4 export',
    body: 'Renders offline as fast as your device allows, not in real time, then falls back to a real-time recording automatically if your browser needs it.',
  },
];

export default function Features() {
  return (
    <section className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6">
      <h2 className="text-center font-[family-name:var(--font-bricolage)] text-[28px] font-extrabold tracking-tight sm:text-[34px]">Everything a promo video needs</h2>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-900">
            <h3 className="text-[17px] font-bold">{f.title}</h3>
            <p className="mt-2 text-[14.5px] text-neutral-600 dark:text-neutral-300">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
