import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-8 text-[13px] text-neutral-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-neutral-400">
        <p className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
          <img src="/brand/logo-mark-dark.svg" alt="" className="h-4 w-4 dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
          <img src="/brand/logo-mark-light.svg" alt="" className="hidden h-4 w-4 dark:block" />
          &copy; {new Date().getFullYear()} Nimina. All rights reserved.
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/pricing" className="hover:text-neutral-900 dark:hover:text-white">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-neutral-900 dark:hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-neutral-900 dark:hover:text-white">
            Terms
          </Link>
          <Link href="/refunds" className="hover:text-neutral-900 dark:hover:text-white">
            Refunds
          </Link>
        </nav>
      </div>
    </footer>
  );
}
