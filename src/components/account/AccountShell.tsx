'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { friendlyAuthError } from '@/lib/auth/messages';
import { checkPassword } from '@/lib/auth/password';
import { createClient } from '@/lib/supabase/client';
import { Field, INPUT, Notice, PasswordField, postAuth } from '../auth/ui';

import StorageMeter from '@/components/storage/StorageMeter';
import type { StorageUsage } from '@/lib/storage/rules';
export interface AccountData {
  email: string;
  newEmailPending: string | null;
  displayName: string;
  avatarUrl: string | null;
  hasPassword: boolean;
  identities: Array<{ id: string; provider: string; email: string | null; createdAt: string | null }>;
  plan: 'free' | 'pro';
  lifetime: { since: string } | null;
  subscription: { status: string; active: boolean; periodEnd: string | null; endsAt: string | null } | null;
  storage: StorageUsage | null;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—');
const BTN = 'rounded-[10px] px-3.5 py-2 text-[13.5px] font-semibold transition-colors disabled:opacity-50';
const BTN_PRIMARY = `${BTN} bg-[#5b4bff] text-white hover:bg-[#6d5eff]`;
const BTN_GHOST = `${BTN} border border-white/[.14] text-[#f4f5f8] hover:bg-white/[.06]`;

function Section({ id, title, description, children, danger }: { id: string; title: string; description?: React.ReactNode; children: React.ReactNode; danger?: boolean }) {
  return (
    <section id={id} className={`rounded-[16px] border p-5 sm:p-6 ${danger ? 'border-[#ff8f76]/30 bg-[#ff8f76]/[.03]' : 'border-white/[.08] bg-[#0f1117]'}`}>
      <h2 className={`font-[family-name:var(--font-space-grotesk)] text-[17px] font-bold ${danger ? 'text-[#ffb3a3]' : ''}`}>{title}</h2>
      {description && <p className="mt-1 text-[13.5px] leading-relaxed text-[#9aa1af]">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Status({ msg }: { msg: { tone: 'error' | 'success' | 'info'; text: string } | null }) {
  return msg ? (
    <div className="mt-3">
      <Notice tone={msg.tone}>{msg.text}</Notice>
    </div>
  ) : null;
}
type Msg = { tone: 'error' | 'success' | 'info'; text: string } | null;

/* ---------- profile ---------- */

function ProfileSection({ data }: { data: AccountData }) {
  const router = useRouter();
  const [name, setName] = useState(data.displayName);
  const [email, setEmail] = useState(data.email);
  const [nameMsg, setNameMsg] = useState<Msg>(null);
  const [emailMsg, setEmailMsg] = useState<Msg>(data.newEmailPending ? { tone: 'info', text: `Waiting for you to confirm ${data.newEmailPending} — check that inbox.` } : null);
  const [busy, setBusy] = useState<'name' | 'email' | null>(null);
  const initials = (data.displayName || data.email).trim().slice(0, 1).toUpperCase();

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setBusy('name');
    const { error } = await createClient().auth.updateUser({ data: { display_name: name.trim() } });
    setBusy(null);
    setNameMsg(error ? { tone: 'error', text: friendlyAuthError(error) } : { tone: 'success', text: 'Saved.' });
    if (!error) router.refresh();
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim().toLowerCase() === data.email.toLowerCase()) return setEmailMsg({ tone: 'info', text: "That's already your email." });
    setBusy('email');
    const { error } = await createClient().auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${location.origin}/auth/callback?next=/account` });
    setBusy(null);
    setEmailMsg(
      error
        ? { tone: 'error', text: friendlyAuthError(error, error.message) }
        : { tone: 'info', text: `Almost done: confirm the change from the link we sent to ${email.trim()}. You may also need to approve it from ${data.email}. Until then you keep signing in with ${data.email}.` },
    );
  }

  return (
    <Section id="profile" title="Profile">
      <div className="flex items-center gap-4">
        {data.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider avatar URL, not worth image optimization
          <img src={data.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <span className="grid h-14 w-14 place-items-center rounded-full bg-[#5b4bff]/30 font-[family-name:var(--font-space-grotesk)] text-[22px] font-bold text-[#cfc8ff]">{initials}</span>
        )}
        <p className="text-[12.5px] text-[#6b7280]">{data.avatarUrl ? 'Your Google profile photo.' : 'Connect Google to use its profile photo.'}</p>
      </div>
      <form onSubmit={saveName} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Display name">
          <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="How we greet you" className={INPUT} />
        </Field>
        <button type="submit" disabled={busy === 'name' || name.trim() === data.displayName} className={BTN_GHOST}>
          {busy === 'name' ? 'Saving…' : 'Save'}
        </button>
      </form>
      <Status msg={nameMsg} />
      <form onSubmit={changeEmail} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Email">
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </Field>
        <button type="submit" disabled={busy === 'email' || email.trim().toLowerCase() === data.email.toLowerCase()} className={BTN_GHOST}>
          {busy === 'email' ? 'Sending…' : 'Change email'}
        </button>
      </form>
      <Status msg={emailMsg} />
    </Section>
  );
}

/* ---------- password ---------- */

function PasswordSection({ data }: { data: AccountData }) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [hasPassword, setHasPassword] = useState(data.hasPassword);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const weak = checkPassword(password, data.email);
    if (weak) return setMsg({ tone: 'error', text: weak });
    if (password !== confirm) return setMsg({ tone: 'error', text: "The two new passwords don't match." });
    setBusy(true);
    const r = await postAuth('/api/auth/set-password', { password, currentPassword: hasPassword ? current : undefined });
    setBusy(false);
    if (!r.ok) return setMsg({ tone: 'error', text: r.error });
    setMsg({ tone: 'success', text: hasPassword ? 'Password changed.' : 'Password set — you can now sign in with your email and password.' });
    setHasPassword(true);
    setCurrent('');
    setPassword('');
    setConfirm('');
  }

  return (
    <Section
      id="password"
      title="Password"
      description={hasPassword ? 'Change the password you sign in with.' : "You don't have a password yet — you sign in with Google or an email code. Add one to sign in with your email and password too."}
    >
      <form onSubmit={submit} className="grid max-w-[420px] gap-4">
        {hasPassword && <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />}
        <PasswordField label={hasPassword ? 'New password' : 'Password'} value={password} onChange={setPassword} autoComplete="new-password" meter email={data.email} />
        <PasswordField label="Confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" invalid={!!confirm && confirm !== password} />
        <div>
          <button type="submit" disabled={busy} className={BTN_PRIMARY}>
            {busy ? 'Saving…' : hasPassword ? 'Change password' : 'Set password'}
          </button>
        </div>
      </form>
      <Status msg={msg} />
      {hasPassword && (
        <p className="mt-3 text-[12.5px] text-[#6b7280]">
          Forgot your current password?{' '}
          <Link href={`/forgot-password?email=${encodeURIComponent(data.email)}`} className="font-semibold text-[#8b7dff]">
            Reset it by email
          </Link>
          .
        </p>
      )}
    </Section>
  );
}

/* ---------- connected accounts ---------- */

function ConnectedSection({ data }: { data: AccountData }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const google = data.identities.find((i) => i.provider === 'google');
  // Every identity is a way to sign in; the email identity also covers
  // codes (and a password, if set). Never remove the last one.
  const onlyMethod = data.identities.length <= 1;

  async function connect() {
    setBusy(true);
    const { error } = await createClient().auth.linkIdentity({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback?next=/account` } });
    if (error) {
      setBusy(false);
      setMsg({ tone: 'error', text: friendlyAuthError(error, error.message) });
    }
  }

  async function disconnect() {
    setBusy(true);
    const supabase = createClient();
    const { data: ids, error: listErr } = await supabase.auth.getUserIdentities();
    const identity = ids?.identities.find((i) => i.provider === 'google');
    if (listErr || !identity) {
      setBusy(false);
      return setMsg({ tone: 'error', text: "Couldn't find the Google connection — refresh and try again." });
    }
    const { error } = await supabase.auth.unlinkIdentity(identity);
    setBusy(false);
    if (error) return setMsg({ tone: 'error', text: friendlyAuthError(error, error.message) });
    setMsg({ tone: 'success', text: 'Google disconnected.' });
    router.refresh();
  }

  return (
    <Section id="connected" title="Sign-in methods">
      <ul className="divide-y divide-white/[.07] rounded-[12px] border border-white/[.08]">
        <li className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold">Email</p>
            <p className="text-[12.5px] text-[#9aa1af]">{data.email} · {data.hasPassword ? 'password and email codes' : 'email codes'}</p>
          </div>
        </li>
        <li className="flex items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[14px] font-semibold">Google</p>
            <p className="text-[12.5px] text-[#9aa1af]">{google ? `Connected${google.email ? ` as ${google.email}` : ''}` : 'Not connected'}</p>
          </div>
          {google ? (
            <button type="button" onClick={disconnect} disabled={busy || onlyMethod} title={onlyMethod ? "It's your only way to sign in — add a password first." : undefined} className={BTN_GHOST}>
              Disconnect
            </button>
          ) : (
            <button type="button" onClick={connect} disabled={busy} className={BTN_GHOST}>
              Connect Google
            </button>
          )}
        </li>
      </ul>
      {google && onlyMethod && <p className="mt-2 text-[12.5px] text-[#6b7280]">Google is your only sign-in method, so it can&apos;t be disconnected. Set a password first.</p>}
      <Status msg={msg} />
    </Section>
  );
}

/* ---------- plan ---------- */

function PlanSection({ data }: { data: AccountData }) {
  const s = data.subscription;
  let detail: string;
  if (data.lifetime) detail = `Lifetime access since ${fmtDate(data.lifetime.since)}.`;
  else if (s?.active && s.endsAt) detail = `Cancelled — Pro stays active until ${fmtDate(s.endsAt)}, then you move to Free.`;
  else if (s?.active) detail = `${s.status === 'past_due' ? 'Payment overdue — update your card to keep Pro. ' : ''}Renews on ${fmtDate(s.periodEnd)}.`;
  else if (data.plan === 'pro') detail = 'Pro.';
  else detail = 'Free: 1 project, 720p video with a watermark, one store size at half resolution, 1 language.';

  return (
    <Section id="plan" title="Plan">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-space-grotesk)] text-[20px] font-bold">{data.lifetime ? 'Pro — Lifetime' : data.plan === 'pro' ? 'Pro' : 'Free'}</p>
          <p className="mt-1 text-[13.5px] text-[#9aa1af]">{detail}</p>
        </div>
        {s ? (
          <a href="/api/paddle/portal" className={BTN_GHOST}>
            Billing & invoices
          </a>
        ) : data.plan === 'free' ? (
          <Link href="/pricing" className={BTN_PRIMARY}>
            Upgrade to Pro
          </Link>
        ) : null}
      </div>
    </Section>
  );
}

/* ---------- sessions ---------- */

type SessionRow = { id: string; created_at: string; updated_at: string; refreshed_at: string | null; user_agent: string | null; ip: string | null; is_current: boolean };

function describeAgent(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}
function ago(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} minutes ago`;
  if (s < 86400) return `${Math.round(s / 3600)} hours ago`;
  return `${Math.round(s / 86400)} days ago`;
}

function SessionsSection() {
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/account/sessions');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg({ tone: 'error', text: body.error ?? "Couldn't load your sessions." });
    setRows(body.sessions);
  }, []);
  useEffect(() => {
    // Fetches on mount; the result is the data source, not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function signOutOne(id: string) {
    await fetch('/api/account/sessions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    void load();
  }
  async function signOutEverywhere() {
    await createClient().auth.signOut({ scope: 'global' });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload: the session just changed, so drop all signed-in client state
    window.location.assign('/login');
  }

  return (
    <Section id="sessions" title="Where you're signed in" description="Signing a device out ends its session within the hour; Sign out everywhere also signs out this device.">
      {rows === null && !msg && <p className="text-[13px] text-[#6b7280]">Loading…</p>}
      {rows && (
        <ul className="divide-y divide-white/[.07] rounded-[12px] border border-white/[.08]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[14px] font-semibold">
                  {describeAgent(r.user_agent)}
                  {r.is_current && <span className="rounded-full bg-[#5fd49a]/20 px-2 py-0.5 text-[10.5px] font-bold text-[#8de0b5] uppercase">This device</span>}
                </p>
                <p className="text-[12.5px] text-[#9aa1af]">
                  Last active {ago(r.refreshed_at ?? r.updated_at ?? r.created_at)}
                  {r.ip ? ` · ${r.ip}` : ''} · signed in {fmtDate(r.created_at)}
                </p>
              </div>
              {!r.is_current && (
                <button type="button" onClick={() => signOutOne(r.id)} className={BTN_GHOST}>
                  Sign out
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Status msg={msg} />
      <button type="button" onClick={signOutEverywhere} className={`${BTN_GHOST} mt-4`}>
        Sign out everywhere
      </button>
    </Section>
  );
}

/* ---------- data + danger zone ---------- */

function DangerZone({ data }: { data: AccountData }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function del() {
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/account/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: typed }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      return setMsg({ tone: 'error', text: body.error ?? 'Deletion failed. Try again.' });
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload: the session just changed, so drop all signed-in client state
    window.location.assign('/?account=deleted');
  }

  return (
    <Section id="delete" title="Delete account" danger description="Permanently deletes your account, every project and every uploaded file. This can't be undone.">
      <ul className="mb-4 list-disc space-y-1 pl-5 text-[13px] text-[#c9cdd8]">
        {data.subscription?.active && <li>Your subscription is cancelled immediately — no further charges and no refund for the current period.</li>}
        <li>Invoices and payment records are kept, as the law requires, but no longer linked to you.</li>
        <li>
          Want a copy first?{' '}
          <a href="/api/account/export" className="font-semibold text-[#8b7dff]">
            Export your data
          </a>
          .
        </li>
      </ul>
      <Field label='Type "DELETE" to confirm'>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" className={`${INPUT} max-w-[260px]`} />
      </Field>
      <Status msg={msg} />
      <button type="button" onClick={del} disabled={typed !== 'DELETE' || busy} className={`${BTN} mt-4 bg-[#d9442a] text-white hover:bg-[#e65537]`}>
        {busy ? 'Deleting…' : 'Delete my account'}
      </button>
    </Section>
  );
}

/** /account — profile, password, sign-in methods, plan, sessions, data export, deletion. */
export default function AccountShell({ data }: { data: AccountData }) {
  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/projects" className="text-[13.5px] font-semibold text-[#9aa1af] hover:text-[#f4f5f8]">
          ← Projects
        </Link>
      </div>
      <h1 className="font-[family-name:var(--font-space-grotesk)] text-[28px] font-bold">Account settings</h1>
      <div className="mt-6 grid gap-5">
        <ProfileSection data={data} />
        <PasswordSection data={data} />
        <ConnectedSection data={data} />
        <PlanSection data={data} />
        {data.storage && (
          <Section id="storage" title="Storage" description="Screenshots, icons and music across all your projects. Deleting a project frees its space right away.">
            <StorageMeter initial={data.storage} />
          </Section>
        )}
        <SessionsSection />
        <Section id="data" title="Your data" description="Download everything we store about you: account details, plan and billing records, every project, and a list of your uploaded files.">
          <a href="/api/account/export" className={BTN_GHOST}>
            Export my data (JSON)
          </a>
        </Section>
        <DangerZone data={data} />
      </div>
    </div>
  );
}
