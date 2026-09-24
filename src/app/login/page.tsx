'use client';

import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

function readSearchParam(name: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(name) || '';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Reads ?error= from the URL (set by /auth/callback on failure) after
  // hydration, rather than in a useState initializer, so the server and
  // client's first render always agree — no hydration mismatch.
  useEffect(() => {
    const err = readSearchParam('error');
    if (err) {
      // One-time read of a value the server can't see (the URL's query
      // string) — this *is* the data source, not a sync of known state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error');
      setErrorMessage(err);
    }
  }, []);

  const nextPath = readSearchParam('next') || '/editor';

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
    } else {
      setStatus('sent');
    }
  }

  async function signInWithGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
  }

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-[#ECEEF2] px-4 dark:bg-[#111318]">
      <div className="w-full max-w-sm rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-900">
        <h1 className="text-xl font-bold">Sign in to Promo Studio</h1>
        <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">Save your projects and pick up where you left off.</p>

        <button
          onClick={signInWithGoogle}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 font-semibold dark:border-white/10 dark:bg-neutral-800"
        >
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3 text-[12px] text-neutral-400">
          <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          or
          <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        </div>

        {status === 'sent' ? (
          <p className="rounded-xl bg-indigo-50 px-3 py-2.5 text-[13.5px] dark:bg-indigo-500/10">
            Check <b>{email}</b> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={sendMagicLink} className="grid gap-2.5">
            <label className="block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
              />
            </label>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {status === 'error' && (
              <div className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-400">
                <p>{errorMessage}</p>
                <p className="mt-1 text-[12px] opacity-80">Tip: open the magic-link email and click the link in the same browser you used to request it — clicking it from a different browser or app (e.g. your phone&apos;s Mail app) will fail.</p>
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
