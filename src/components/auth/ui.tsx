'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';

import { passwordStrength } from '@/lib/auth/password';

/** Shared building blocks for the auth pages — dark, matching the landing page. */

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]';
export const INPUT =
  'mt-1.5 block w-full rounded-[10px] border border-white/[.14] bg-white/[.04] px-3 py-2.5 text-[15px] text-[#f4f5f8] placeholder:text-[#5d6472] outline-none focus:border-[#8b7dff] aria-[invalid=true]:border-[#ff8f76]';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[400px] rounded-[20px] border border-white/[.09] bg-[#0f1117] p-6 shadow-[0_30px_80px_rgba(0,0,0,.45)] sm:p-7">
      <h1 className="font-[family-name:var(--font-space-grotesk)] text-[22px] font-bold text-[#f4f5f8]">{title}</h1>
      {subtitle && <p className="mt-1.5 text-[14px] leading-relaxed text-[#9aa1af]">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block text-[13px] font-semibold text-[#c9cdd8]">
      <span className="flex items-baseline justify-between gap-2">
        {label}
        {hint}
      </span>
      {children}
    </label>
  );
}

export function PrimaryButton({ busy, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      type="submit"
      {...props}
      disabled={busy || props.disabled}
      className={`w-full rounded-[10px] bg-[#5b4bff] px-4 py-2.5 text-[15px] font-semibold text-white transition-colors hover:bg-[#6d5eff] disabled:opacity-50 ${FOCUS}`}
    >
      {children}
    </button>
  );
}

export function Notice({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const cls = tone === 'error' ? 'border-[#ff8f76]/30 bg-[#ff8f76]/[.08] text-[#ffc4b6]' : tone === 'success' ? 'border-[#5fd49a]/30 bg-[#5fd49a]/[.08] text-[#b6f0d0]' : 'border-[#8b7dff]/30 bg-[#5b4bff]/[.1] text-[#d6d0ff]';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-[10px] border px-3 py-2.5 text-[13.5px] leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

export function Divider({ label = 'or' }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3 text-[12px] text-[#8b93a1]">
      <span className="h-px flex-1 bg-white/[.09]" />
      {label}
      <span className="h-px flex-1 bg-white/[.09]" />
    </div>
  );
}

export function LastUsed() {
  return <span className="rounded-full bg-[#5b4bff]/25 px-2 py-0.5 text-[10.5px] font-bold tracking-wide text-[#cfc8ff] uppercase">Last used</span>;
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

export function GoogleButton({ onClick, lastUsed, label = 'Continue with Google' }: { onClick: () => void; lastUsed?: boolean; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex w-full items-center justify-center gap-2.5 rounded-[10px] border border-white/[.16] bg-white/[.03] px-4 py-2.5 text-[15px] font-semibold text-[#f4f5f8] transition-colors hover:bg-white/[.07] ${FOCUS}`}
    >
      <GoogleMark />
      {label}
      {lastUsed && (
        <span className="absolute right-3">
          <LastUsed />
        </span>
      )}
    </button>
  );
}

/** Password input with show/hide and (optionally) the strength meter. */
export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  meter,
  email,
  hint,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: 'current-password' | 'new-password';
  meter?: boolean;
  email?: string;
  hint?: React.ReactNode;
  invalid?: boolean;
}) {
  const [show, setShow] = useState(false);
  const meterId = useId();
  const s = meter ? passwordStrength(value, email) : null;
  const colors = ['#ff8f76', '#ff8f76', '#f2cf6b', '#8de0b5', '#5fd49a'];
  return (
    <div>
      <Field label={label} hint={hint}>
        <span className="relative block">
          <input
            type={show ? 'text' : 'password'}
            required
            autoComplete={autoComplete}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-invalid={invalid || undefined}
            aria-describedby={meter ? meterId : undefined}
            className={`${INPUT} pr-16`}
          />
          <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2 mt-[3px] -translate-y-1/2 rounded px-2 py-1 text-[12px] font-semibold text-[#9aa1af] hover:text-[#f4f5f8]">
            {show ? 'Hide' : 'Show'}
          </button>
        </span>
      </Field>
      {s && (
        <div id={meterId} className="mt-2" aria-live="polite">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className="h-1 flex-1 rounded-full" style={{ background: value && s.score >= i ? colors[s.score] : 'rgba(255,255,255,.1)' }} />
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-[#9aa1af]">{value ? `${s.label}. ` : ''}At least 8 characters; avoid common passwords. Longer is stronger.</p>
        </div>
      )}
    </div>
  );
}

/** Counts down from `seconds` once started; returns [remaining, start]. */
export function useCooldown(): [number, (seconds: number) => void] {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return [left, setLeft];
}

export function AuthFooterLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link href={href} className="font-semibold text-[#8b7dff] hover:text-[#a89bff]">
      {children}
    </Link>
  );
}

/* ---------- helpers ---------- */

export type AuthMethod = 'password' | 'code' | 'google';
const LAST_METHOD_KEY = 'nimina:last-sign-in-method';

export function readLastMethod(): AuthMethod | null {
  try {
    const v = localStorage.getItem(LAST_METHOD_KEY);
    return v === 'password' || v === 'code' || v === 'google' ? v : null;
  } catch {
    return null;
  }
}
export function rememberMethod(m: AuthMethod) {
  try {
    localStorage.setItem(LAST_METHOD_KEY, m);
  } catch {
    // private mode etc. — a convenience only
  }
}

export type AuthResult = { ok: true; message?: string } | { ok: false; error: string; code?: string; retryAfter?: number };

export async function postAuth(url: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await res.json()) as AuthResult;
  } catch {
    return { ok: false, error: "Couldn't reach Nimina. Check your connection and try again." };
  }
}

const BACKSLASH = String.fromCharCode(92);

/** Where to go after signing in: only a path on this site, else /projects.
 * Rejects protocol-relative and backslash forms ("//host", "/" + backslash
 * + "host") that browsers resolve to another site, and whitespace/control
 * characters. */
export function safeNext(raw: string | null): string {
  return isSafeNextPath(raw) ? raw! : '/projects';
}

export function isSafeNextPath(raw: string | null | undefined): boolean {
  return !!raw && raw.length < 512 && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes(BACKSLASH) && !/[\s\x00-\x1f]/.test(raw);
}
