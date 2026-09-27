import Link from 'next/link';

/** Paddle's checkout `successUrl` redirect target (see openCheckout() in
 * PricingShell.tsx). Purely informational — the actual plan upgrade
 * happens via the `subscription.*`/`transaction.completed` webhook, which
 * can land slightly before or after the visitor is redirected here, so
 * this page never reads `profiles.plan` itself to avoid a false "not
 * upgraded yet" flash on a race. */
export default function WelcomePage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 bg-[#ECEEF2] px-4 dark:bg-[#111318]">
      <div className="w-full max-w-sm rounded-3xl border border-black/10 bg-white p-6 text-center dark:border-white/10 dark:bg-neutral-900">
        <h1 className="text-xl font-bold">You&apos;re all set 🎉</h1>
        <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">Thanks for upgrading. Your account updates automatically — it may take a few seconds to reflect in the editor.</p>
        <Link href="/editor" className="mt-5 inline-block w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white">
          Go to the editor
        </Link>
      </div>
    </main>
  );
}
