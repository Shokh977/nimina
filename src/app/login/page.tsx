'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

type Mode = 'signin' | 'signup';
type Step = 'email' | 'code';

const RESEND_COOLDOWN_S = 60; // Supabase's default per-address email rate limit

/** Only same-site paths — `next` comes from the URL, so it must never be
 * able to send a freshly signed-in user to another origin. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/projects';
  return raw;
}

/** An explicit ?mode= wins. Otherwise a `next` param means a protected page
 * bounced a (probably returning) user here → Sign in; a bare /login is what
 * the marketing CTAs link to → Create account. */
function initialMode(params: URLSearchParams): Mode {
  const m = params.get('mode');
  if (m === 'signin' || m === 'signup') return m;
  return params.get('next') ? 'signin' : 'signup';
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="h-[18px] w-[18px]">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * Sign in and Create account, one page with a tab switch. Both use the same
 * passwordless methods: Google, or an email carrying a 6-digit code AND a
 * link. The code works from any device (read it on a phone, type it here),
 * which the link alone can't — the PKCE link only completes in the browser
 * that requested it. Requires the Supabase "Magic Link" and "Confirm
 * signup" email templates to include {{ .Token }} (see CLAUDE.md).
 */
function LoginForm() {
  const params = useSearchParams();
  const nextPath = safeNext(params.get('next'));
  const [mode, setMode] = useState<Mode>(() => initialMode(params));
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') ?? '');
  const [noAccount, setNoAccount] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const callbackUrl = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setNoAccount(false);
  };

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    setNoAccount(false);
    const { error: err } = await createClient().auth.signInWithOtp({
      email,
      // Sign in never silently creates an account for a mistyped address.
      options: { emailRedirectTo: callbackUrl(), shouldCreateUser: mode === 'signup' },
    });
    setBusy(false);
    if (err) {
      if (mode === 'signin' && /signups not allowed|user not found|otp_disabled/i.test(`${err.code ?? ''} ${err.message}`)) setNoAccount(true);
      else setError(err.message);
      return;
    }
    setStep('code');
    setCode('');
    setCooldown(RESEND_COOLDOWN_S);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await createClient().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    if (err) {
      setBusy(false);
      setError(/expired|invalid/i.test(err.message) ? 'That code is wrong or has expired. Check the latest email, or send a new code.' : err.message);
      return;
    }
    // Full navigation so server components see the new session cookies.
    window.location.assign(nextPath);
  }

  async function google() {
    await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl() } });
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => switchMode(m)}
      className="flex-1 rounded-lg px-3 py-2 text-[13.5px] font-semibold text-neutral-500 aria-selected:bg-white aria-selected:text-neutral-900 aria-selected:shadow-sm dark:text-neutral-400 dark:aria-selected:bg-neutral-700 dark:aria-selected:text-white"
    >
      {label}
    </button>
  );

  return (
    <div className="w-full max-w-sm rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-900">
      {step === 'email' ? (
        <>
          <div role="tablist" aria-label="Sign in or create an account" className="flex gap-1 rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
            {tab('signin', 'Sign in')}
            {tab('signup', 'Create account')}
          </div>

          <h1 className="mt-5 text-xl font-bold">{mode === 'signup' ? 'Create your free account' : 'Welcome back'}</h1>
          <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">
            {mode === 'signup' ? 'Turn your app screenshots into promo videos. No card needed.' : 'Sign in to pick up where you left off.'}
          </p>

          <button
            type="button"
            onClick={google}
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-xl border border-black/15 bg-white px-4 py-2.5 font-semibold hover:bg-neutral-50 dark:border-white/15 dark:bg-neutral-800 dark:hover:bg-neutral-700"
          >
            <GoogleMark />
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3 text-[12px] text-neutral-400">
            <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
            or with email
            <span className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          </div>

          <form onSubmit={sendCode} className="grid gap-2.5">
            <label className="block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[14.5px] dark:border-white/10 dark:bg-neutral-800"
              />
            </label>
            <button type="submit" disabled={busy} className="rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
              {busy ? 'Sending…' : mode === 'signup' ? 'Create account' : 'Sign in'}
            </button>
          </form>

          {noAccount && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">
              No account uses {email}.{' '}
              <button type="button" onClick={() => switchMode('signup')} className="font-semibold underline">
                Create one instead
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <p className="mt-4 text-[12px] text-neutral-500 dark:text-neutral-400">
              By continuing you agree to the{' '}
              <Link href="/terms" className="underline">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>
              .
            </p>
          )}
        </>
      ) : (
        <>
          <h1 className="text-xl font-bold">Check your email</h1>
          <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">
            We sent a 6-digit code to <b className="text-neutral-800 dark:text-neutral-200">{email}</b>. Enter it here — it works from any device.
          </p>
          <form onSubmit={verifyCode} className="mt-5 grid gap-2.5">
            <label className="block text-[12.5px] font-semibold text-neutral-500 dark:text-neutral-400">
              Code
              <input
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,10}"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="mt-1 block w-full rounded-lg border border-black/10 bg-white px-2.5 py-2 text-center font-mono text-[22px] tracking-[0.4em] dark:border-white/10 dark:bg-neutral-800"
              />
            </label>
            <button type="submit" disabled={busy || code.length < 6} className="rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white hover:bg-indigo-500 disabled:opacity-50">
              {busy ? 'Checking…' : 'Continue'}
            </button>
          </form>
          <p className="mt-3 text-[12.5px] text-neutral-500 dark:text-neutral-400">Or click the link in the email — on this device and in this browser.</p>
          <div className="mt-4 flex items-center justify-between text-[13px] font-semibold">
            <button type="button" onClick={() => sendCode()} disabled={busy || cooldown > 0} className="text-indigo-600 disabled:text-neutral-400 dark:text-indigo-400">
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('email');
                setError('');
              }}
              className="text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            >
              Use a different email
            </button>
          </div>
        </>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p>}
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 bg-[#ECEEF2] px-4 py-10 dark:bg-[#111318]">
      <Link href="/" className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
        <img src="/brand/logo-mark-dark.svg" alt="" className="h-7 w-7 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
        <img src="/brand/logo-mark-light.svg" alt="" className="hidden h-7 w-7 dark:block" />
        <span className="text-lg font-bold">Nimina</span>
      </Link>
      {/* useSearchParams needs a Suspense boundary for the static render. */}
      <Suspense fallback={<div className="h-[420px] w-full max-w-sm rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-neutral-900" />}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
