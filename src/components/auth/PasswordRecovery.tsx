'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { checkPassword } from '@/lib/auth/password';
import { createClient } from '@/lib/supabase/client';
import { AuthCard, AuthFooterLink, Field, INPUT, Notice, PasswordField, PrimaryButton, postAuth, safeNext, useCooldown } from './ui';

/** /forgot-password — sends a reset link; same answer for any address. */
export function ForgotPasswordForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');
  const [cooldown, startCooldown] = useCooldown();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await postAuth('/api/auth/forgot-password', { email });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.retryAfter) startCooldown(r.retryAfter);
      return;
    }
    setSent(r.message ?? 'Check your email.');
    startCooldown(60);
  }

  return (
    <AuthCard title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Email">
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={INPUT} />
        </Field>
        {sent && <Notice tone="success">{sent}</Notice>}
        {error && <Notice>{error}</Notice>}
        <PrimaryButton busy={busy || cooldown > 0}>{busy ? 'Sending…' : cooldown > 0 ? `Send again in ${cooldown}s` : sent ? 'Send again' : 'Send reset link'}</PrimaryButton>
      </form>
      <p className="mt-6 text-center text-[13.5px] text-[#9aa1af]">
        Remembered it? <AuthFooterLink href="/login">Back to sign in</AuthFooterLink>
      </p>
    </AuthCard>
  );
}

/** /reset-password — reached from the reset link (/auth/callback verified it
 * and started a session). Sets the new password via /api/auth/set-password. */
export function ResetPasswordForm() {
  const [state, setState] = useState<'checking' | 'ready' | 'no-session' | 'done'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [current, setCurrent] = useState('');
  const [needCurrent, setNeedCurrent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? '');
        setState(data.user ? 'ready' : 'no-session');
      });
  }, []);

  const weak = password ? checkPassword(password, email) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (weak) return setError(weak);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError('');
    const r = await postAuth('/api/auth/set-password', { password, currentPassword: needCurrent ? current : undefined });
    setBusy(false);
    if (!r.ok) {
      if (r.code === 'current_required') setNeedCurrent(true);
      setError(r.error);
      return;
    }
    setState('done');
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload: the session just changed
    setTimeout(() => window.location.assign('/projects'), 1500);
  }

  if (state === 'checking') return <AuthCard title="Choose a new password">{null}</AuthCard>;
  if (state === 'no-session')
    return (
      <AuthCard title="This link has expired" subtitle="Password reset links work once and expire after an hour.">
        <a href="/forgot-password" className="block w-full rounded-[10px] bg-[#5b4bff] px-4 py-2.5 text-center text-[15px] font-semibold text-white hover:bg-[#6d5eff]">
          Send a new link
        </a>
      </AuthCard>
    );
  if (state === 'done')
    return (
      <AuthCard title="Password updated">
        <Notice tone="success">You&apos;re signed in. Taking you to your projects…</Notice>
      </AuthCard>
    );

  return (
    <AuthCard title="Choose a new password" subtitle={email ? `For ${email}.` : undefined}>
      <form onSubmit={submit} className="grid gap-4">
        {needCurrent && <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />}
        <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" meter email={email} />
        <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={!!confirm && confirm !== password} />
        {error && <Notice>{error}</Notice>}
        <PrimaryButton busy={busy}>{busy ? 'Saving…' : 'Save password'}</PrimaryButton>
      </form>
    </AuthCard>
  );
}

/** /verify-email — after a password sign-up. The email has a link and a
 * 6-digit code; the code works here from any device. */
export function VerifyEmailForm() {
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, startCooldown] = useCooldown();

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await postAuth('/api/auth/otp/verify', { email, code, stay: true });
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      return;
    }
    window.location.assign(next);
  }

  async function resend() {
    setError('');
    const r = await postAuth('/api/auth/resend-verification', { email });
    if (!r.ok) {
      setError(r.error);
      if (r.retryAfter) startCooldown(r.retryAfter);
      return;
    }
    setInfo(r.message ?? 'Sent.');
    startCooldown(60);
  }

  return (
    <AuthCard
      title="Verify your email"
      subtitle={
        email ? (
          <>
            We sent a link and a 6-digit code to <b className="text-[#f4f5f8]">{email}</b>. Click the link, or enter the code here — from any device.
          </>
        ) : (
          'Enter the address you signed up with and the 6-digit code from the email.'
        )
      }
    >
      <form onSubmit={verify} className="grid gap-4">
        {!params.get('email') && (
          <Field label="Email">
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
          </Field>
        )}
        <Field label="6-digit code">
          <input
            required
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            maxLength={10}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="••••••"
            className={`${INPUT} text-center font-mono text-[24px] tracking-[0.45em]`}
          />
        </Field>
        {info && <Notice tone="info">{info}</Notice>}
        {error && <Notice>{error}</Notice>}
        <PrimaryButton busy={busy} disabled={code.length < 6}>
          {busy ? 'Verifying…' : 'Verify and continue'}
        </PrimaryButton>
      </form>
      <div className="mt-4 flex items-center justify-between text-[13px] font-semibold">
        <button type="button" onClick={resend} disabled={!email || cooldown > 0} className="text-[#8b7dff] hover:text-[#a89bff] disabled:text-[#5d6472]">
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </button>
        <AuthFooterLink href="/signup">Use a different email</AuthFooterLink>
      </div>
      <p className="mt-4 text-[12px] text-[#8b93a1]">You can&apos;t sign in or export until the address is verified. Didn&apos;t get it? Check spam.</p>
    </AuthCard>
  );
}
