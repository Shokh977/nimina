'use client';

import { useState } from 'react';

import { Field, INPUT, Notice, PrimaryButton, postAuth, rememberMethod, useCooldown } from './ui';

const RESEND_SECONDS = 60;

/**
 * Email + 6-digit code. Step 1 asks for the address and sends the code
 * (/api/auth/otp/request); step 2 takes the code (/api/auth/otp/verify).
 * Nothing is tied to this browser, so the code can be read on a phone and
 * typed on a laptop. `intent` decides whether a new address gets an account.
 */
export default function CodeSignIn({
  intent,
  next,
  stay,
  email,
  setEmail,
}: {
  intent: 'signin' | 'signup';
  next: string;
  stay: boolean;
  email: string;
  setEmail: (v: string) => void;
}) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [cooldown, startCooldown] = useCooldown();

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    const r = await postAuth('/api/auth/otp/request', { email, intent });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      if (r.retryAfter) startCooldown(r.retryAfter);
      return;
    }
    setInfo(r.message ?? '');
    setStep('code');
    setCode('');
    startCooldown(RESEND_SECONDS);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const r = await postAuth('/api/auth/otp/verify', { email, code, stay });
    if (!r.ok) {
      setBusy(false);
      setError(r.error);
      return;
    }
    rememberMethod('code');
    window.location.assign(next); // full load so the server sees the new session
  }

  if (step === 'email') {
    return (
      <form onSubmit={send} className="grid gap-4">
        <Field label="Email">
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={INPUT} />
        </Field>
        {error && <Notice>{error}</Notice>}
        <PrimaryButton busy={busy || cooldown > 0}>{busy ? 'Sending…' : cooldown > 0 ? `Try again in ${cooldown}s` : 'Email me a code'}</PrimaryButton>
      </form>
    );
  }

  return (
    <form onSubmit={verify} className="grid gap-4">
      <Notice tone="info">
        {info || 'A 6-digit code is on its way.'} Sent to <b>{email}</b> — you can read it on any device.
      </Notice>
      <Field label="6-digit code">
        <input
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          maxLength={10}
          value={code}
          onChange={(e) => {
            setCode(e.target.value.replace(/\D/g, ''));
            setError('');
          }}
          aria-invalid={!!error || undefined}
          placeholder="••••••"
          className={`${INPUT} text-center font-mono text-[24px] tracking-[0.45em]`}
        />
      </Field>
      {error && <Notice>{error}</Notice>}
      <PrimaryButton busy={busy} disabled={code.length < 6}>
        {busy ? 'Checking…' : 'Continue'}
      </PrimaryButton>
      <div className="flex items-center justify-between text-[13px] font-semibold">
        <button type="button" onClick={() => send()} disabled={busy || cooldown > 0} className="text-[#8b7dff] hover:text-[#a89bff] disabled:text-[#5d6472]">
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
        <button
          type="button"
          onClick={() => {
            setStep('email');
            setError('');
          }}
          className="text-[#9aa1af] hover:text-[#f4f5f8]"
        >
          Use a different email
        </button>
      </div>
      <p className="text-[12px] text-[#6b7280]">Codes expire after 10 minutes. Only the newest code works.</p>
    </form>
  );
}
