import Link from 'next/link';

export default function Nav({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
          <img src="/brand/logo-mark-dark.svg" alt="" className="h-6 w-6 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
          <img src="/brand/logo-mark-light.svg" alt="" className="hidden h-6 w-6 dark:block" />
          <span className="font-[family-name:var(--font-bricolage)] text-lg font-extrabold tracking-tight">Nimina</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link href="/pricing" className="hidden px-2 py-1.5 text-[14px] font-semibold text-neutral-600 hover:text-neutral-900 sm:inline dark:text-neutral-300 dark:hover:text-white">
            Pricing
          </Link>
          {signedIn ? (
            <Link href="/projects" className="rounded-xl bg-indigo-600 px-4 py-2 text-[14px] font-bold text-white">
              Go to app
            </Link>
          ) : (
            <>
              <Link href="/login?mode=signin" className="px-2 py-1.5 text-[14px] font-semibold text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                Log in
              </Link>
              <Link href="/login?mode=signup" className="rounded-xl bg-indigo-600 px-4 py-2 text-[14px] font-bold text-white">
                Start free
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
