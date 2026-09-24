/**
 * Placeholder for the real demo video — swap this out once you've exported
 * one from the editor (drop it in /public and replace this component with
 * a <video> tag, or embed wherever you end up hosting it).
 */
export default function DemoPlaceholder() {
  return (
    <section className="mx-auto max-w-[900px] px-4 sm:px-6">
      <div className="relative aspect-video overflow-hidden rounded-3xl bg-[#1B1E26] shadow-[0_24px_60px_rgba(0,0,0,.25)]">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#E8EAF0]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-6 w-6" aria-hidden>
              <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z" />
            </svg>
          </div>
          <p className="text-[13.5px] font-semibold text-white/70">Demo video placeholder — replace with one made in the app</p>
        </div>
      </div>
    </section>
  );
}
