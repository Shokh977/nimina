import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-4 px-4 py-8 text-[13px] text-neutral-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-neutral-400">
        <p>&copy; {new Date().getFullYear()} Promo Studio. All rights reserved.</p>
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
