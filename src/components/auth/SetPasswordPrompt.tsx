'use client';

import { useState } from 'react';

import { checkPassword } from '@/lib/auth/password';
import { createClient } from '@/lib/supabase/client';
import { Notice, PasswordField, postAuth } from './ui';

/**
 * Shown once to accounts created by magic link (email identity, no
 * password, no Google): offers to add a password. Skippable — "Not now"
 * records `password_prompt_done` so it never returns, and email codes keep
 * working for these accounts indefinitely either way.
 */
export default function SetPasswordPrompt({ email }: { email: string }) {
  const [open, setOpen] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (!open) return null;

  async function dismiss() {
    setOpen(false);
    await createClient().auth.updateUser({ data: { password_prompt_done: true } });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const weak = checkPassword(password, email);
    if (weak) return setError(weak);
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    const r = await postAuth('/api/auth/set-password', { password });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setDone(true);
    setTimeout(() => setOpen(false), 1600);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="set-pw-title" className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-[420px] rounded-[18px] border border-white/[.09] bg-[#0f1117] p-6 text-[#f4f5f8] shadow-2xl">
        <h2 id="set-pw-title" className="font-[family-name:var(--font-space-grotesk)] text-[20px] font-bold">
          Add a password?
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#9aa1af]">
          Sign in faster with your email and a password. Email codes keep working too — this is optional.
        </p>
        {done ? (
          <div className="mt-5">
            <Notice tone="success">Password set.</Notice>
          </div>
        ) : (
          <form onSubmit={save} className="mt-5 grid gap-4">
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" meter email={email} />
            <PasswordField label="Confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={!!confirm && confirm !== password} />
            {error && <Notice>{error}</Notice>}
            <div className="flex gap-2.5">
              <button type="submit" disabled={busy} className="flex-1 rounded-[10px] bg-[#5b4bff] px-4 py-2.5 text-[14.5px] font-semibold text-white hover:bg-[#6d5eff] disabled:opacity-50">
                {busy ? 'Saving…' : 'Set password'}
              </button>
              <button type="button" onClick={dismiss} className="rounded-[10px] border border-white/[.14] px-4 py-2.5 text-[14.5px] font-semibold hover:bg-white/[.06]">
                Not now
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
