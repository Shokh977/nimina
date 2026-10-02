'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createClient, setPersistPreference } from '@/lib/supabase/client';
import CodeSignIn from './CodeSignIn';
import { AuthCard, AuthFooterLink, Divider, Field, GoogleButton, INPUT, LastUsed, Notice, PasswordField, PrimaryButton, postAuth, readLastMethod, rememberMethod, safeNext, type AuthMethod } from './ui';

export async function startGoogle(next: string, stay: boolean) {
  setPersistPreference(stay);
  rememberMethod('google');
  await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` } });
}

export function MethodTabs({ method, setMethod, last }: { method: 'password' | 'code'; setMethod: (m: 'password' | 'code') => void; last: AuthMethod | null }) {
  const tab = (m: 'password' | 'code', label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={method === m}
      onClick={() => setMethod(m)}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 py-2 text-[13.5px] font-semibold text-[#9aa1af] aria-selected:bg-white/[.09] aria-selected:text-[#f4f5f8]"
    >
      {label}
      {last === m && <LastUsed />}
    </button>
  );
  return (
    <div role="tablist" aria-label="Sign-in method" className="mb-5 flex gap-1 rounded-[10px] border border-white/[.09] p-1">
      {tab('password', 'Password')}
      {tab('code', 'Email code')}
    </div>
  );
}

/** /login — Google, email + password, or email + 6-digit code. */
export default function SignInForm() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [last, setLast] = useState<AuthMethod | null>(null);
  const [method, setMethod] = useState<'password' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stay, setStay] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') ?? '');
  const [unverified, setUnverified] = useState(false);

  useEffect(() => {
    // Remembered on this device only (localStorage) — a one-time read after hydration.
    const m = readLastMethod();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLast(m);
    if (m === 'code') setMethod('code');
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setUnverified(false);
    const r = await postAuth('/api/auth/sign-in', { email, password, stay });
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      setUnverified(r.code === 'unverified');
      return;
    }
    rememberMethod('password');
    window.location.assign(next);
  }

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to pick up where you left off.">
      <GoogleButton onClick={() => startGoogle(next, stay)} lastUsed={last === 'google'} />
      <Divider label="or with email" />
      <MethodTabs method={method} setMethod={setMethod} last={last} />

      {method === 'password' ? (
        <form onSubmit={signIn} className="grid gap-4">
          <Field label="Email">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={INPUT} />
          </Field>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            hint={
              <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-[12.5px] font-semibold text-[#8b7dff] hover:text-[#a89bff]">
                Forgot password?
              </Link>
            }
          />
          {error && (
            <Notice>
              {error}
              {unverified && (
                <>
                  {' '}
                  <Link href={`/verify-email?email=${encodeURIComponent(email)}`} className="font-semibold underline">
                    Resend verification
                  </Link>
                </>
              )}
            </Notice>
          )}
          <PrimaryButton busy={busy}>{busy ? 'Signing in…' : 'Sign in'}</PrimaryButton>
        </form>
      ) : (
        <>
          {error && (
            <div className="mb-4">
              <Notice>{error}</Notice>
            </div>
          )}
          <CodeSignIn intent="signin" next={next} stay={stay} email={email} setEmail={setEmail} />
        </>
      )}

      <label className="mt-4 flex items-center gap-2 text-[13.5px] text-[#c9cdd8]">
        <input type="checkbox" checked={stay} onChange={(e) => setStay(e.target.checked)} className="h-4 w-4 accent-[#5b4bff]" />
        Stay signed in
      </label>

      <p className="mt-6 text-center text-[13.5px] text-[#9aa1af]">
        New to Nimina? <AuthFooterLink href={`/signup${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Create an account</AuthFooterLink>
      </p>
    </AuthCard>
  );
}
