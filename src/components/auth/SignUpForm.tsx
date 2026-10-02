'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { checkPassword } from '@/lib/auth/password';
import CodeSignIn from './CodeSignIn';
import { MethodTabs, startGoogle } from './SignInForm';
import { AuthCard, AuthFooterLink, Divider, Field, GoogleButton, INPUT, Notice, PasswordField, PrimaryButton, postAuth, readLastMethod, safeNext, type AuthMethod } from './ui';

/** /signup — Google, email + password (verified by email before first
 * sign-in), or email + 6-digit code (the code itself verifies the address). */
export default function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [last, setLast] = useState<AuthMethod | null>(null);
  const [method, setMethod] = useState<'password' | 'code'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLast(readLastMethod());
  }, []);

  const weak = password ? checkPassword(password, email) : null;

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (weak) return;
    setBusy(true);
    setError('');
    const r = await postAuth('/api/auth/sign-up', { email, password });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.push(`/verify-email?email=${encodeURIComponent(email)}${params.get('next') ? `&next=${encodeURIComponent(next)}` : ''}`);
  }

  return (
    <AuthCard title="Create your free account" subtitle="Turn app screenshots into promo videos. No card needed.">
      <GoogleButton onClick={() => startGoogle(next, true)} label="Sign up with Google" />
      <Divider label="or with email" />
      <MethodTabs method={method} setMethod={setMethod} last={last === 'google' ? null : last} />

      {method === 'password' ? (
        <form onSubmit={signUp} className="grid gap-4">
          <Field label="Email">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={INPUT} />
          </Field>
          <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" meter email={email} invalid={touched && !!weak} />
          {touched && weak && <Notice>{weak}</Notice>}
          {error && <Notice>{error}</Notice>}
          <PrimaryButton busy={busy}>{busy ? 'Creating account…' : 'Create account'}</PrimaryButton>
        </form>
      ) : (
        <CodeSignIn intent="signup" next={next} stay email={email} setEmail={setEmail} />
      )}

      <p className="mt-4 text-[12.5px] leading-relaxed text-[#6b7280]">
        By creating an account you agree to the{' '}
        <Link href="/terms" className="underline hover:text-[#9aa1af]">
          Terms
        </Link>{' '}
        and{' '}
        <Link href="/privacy" className="underline hover:text-[#9aa1af]">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="mt-5 text-center text-[13.5px] text-[#9aa1af]">
        Already have an account? <AuthFooterLink href={`/login${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>Sign in</AuthFooterLink>
      </p>
    </AuthCard>
  );
}
