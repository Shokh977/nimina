'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import UserMenu from '@/components/auth/UserMenu';
import TemplateWizard from './TemplateWizard';

export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  swatch: [string, string];
  durationSeconds?: number;
  slotCount?: number;
  previewVideo9x16?: string;
}

/** `userEmail` is null for a signed-out visitor: the gallery is public, and
 * picking a template asks them to sign up first, then brings them back here
 * with that template's wizard open (`?open=<id>`). */
export default function TemplatesShell({ userEmail, templates }: { userEmail: string | null; templates: TemplateSummary[] }) {
  const signedIn = userEmail !== null;
  const [openId, setOpenId] = useState<string | null>(null);
  const [signUpFor, setSignUpFor] = useState<TemplateSummary | null>(null);

  useEffect(() => {
    // Back from sign-up with a template already chosen — reopen it. A
    // one-time read of the URL (not known to the server render).
    const id = new URLSearchParams(window.location.search).get('open');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id && signedIn && templates.some((t) => t.id === id)) setOpenId(id);
  }, [signedIn, templates]);

  const choose = (t: TemplateSummary) => (signedIn ? setOpenId(t.id) : setSignUpFor(t));

  return (
    <main className="mx-auto max-w-[1200px] px-3 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <Link href={signedIn ? '/projects' : '/'} className="text-lg font-bold hover:underline">
          Nimina
        </Link>
        {signedIn ? (
          <UserMenu email={userEmail} />
        ) : (
          <div className="flex items-center gap-3 text-[14px] font-semibold">
            <Link href="/login?next=/templates" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
              Log in
            </Link>
            <Link href="/signup?next=/templates" className="rounded-xl bg-indigo-600 px-3.5 py-2 text-white hover:bg-indigo-500">
              Start free
            </Link>
          </div>
        )}
      </div>

      <div className="mt-6">
        <h1 className="text-2xl font-bold">Start from a template</h1>
        <p className="mt-1 text-[13.5px] text-neutral-600 dark:text-neutral-400">Pick a style, drop in your screenshots, and you&apos;re editing a finished promo in seconds.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => choose(t)}
            className="group overflow-hidden rounded-2xl border border-black/10 bg-white text-left transition-shadow hover:shadow-lg dark:border-white/10 dark:bg-neutral-900"
          >
            {t.previewVideo9x16 ? (
              <video
                src={t.previewVideo9x16}
                className="h-[220px] w-full object-cover"
                style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <div className="h-[120px]" style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }} />
            )}
            <div className="p-4">
              <span className="text-[11px] font-bold tracking-wide text-indigo-600 uppercase dark:text-indigo-400">{t.category}</span>
              <h3 className="mt-1 text-[16px] font-bold">{t.name}</h3>
              <p className="mt-1 text-[13px] text-neutral-600 dark:text-neutral-400">{t.description}</p>
              {(t.durationSeconds || t.slotCount) && (
                <p className="mt-1.5 text-[11.5px] font-semibold text-neutral-600 dark:text-neutral-500">
                  {t.durationSeconds ? `${Math.round(t.durationSeconds)}s` : null}
                  {t.durationSeconds && t.slotCount ? ' · ' : null}
                  {t.slotCount ? `${t.slotCount} screenshot${t.slotCount === 1 ? '' : 's'}` : null}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {templates.length === 0 && <p className="mt-8 text-center text-[14px] text-neutral-600 dark:text-neutral-400">No templates available right now.</p>}

      {openId && <TemplateWizard templateId={openId} onClose={() => setOpenId(null)} />}

      {signUpFor && (
        <div role="dialog" aria-modal="true" aria-labelledby="signup-title" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setSignUpFor(null)}>
          <div className="w-full max-w-[380px] rounded-2xl bg-white p-6 text-center shadow-xl dark:bg-neutral-900" onClick={(e) => e.stopPropagation()}>
            <h2 id="signup-title" className="text-lg font-bold">
              Use “{signUpFor.name}”
            </h2>
            <p className="mt-2 text-[13.5px] text-neutral-600 dark:text-neutral-400">Create a free account to drop your screenshots into this template. No card needed.</p>
            <Link
              href={`/signup?next=${encodeURIComponent(`/templates?open=${signUpFor.id}`)}`}
              className="mt-5 block rounded-xl bg-indigo-600 px-4 py-2.5 font-bold text-white hover:bg-indigo-500"
            >
              Start free
            </Link>
            <button type="button" onClick={() => setSignUpFor(null)} className="mt-2 w-full rounded-xl px-4 py-2 text-[13.5px] font-semibold text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              Keep browsing
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
