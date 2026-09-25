'use client';

import Link from 'next/link';
import { useState } from 'react';

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

export default function TemplatesShell({ userEmail, templates }: { userEmail: string; templates: TemplateSummary[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-[1200px] px-3 py-6 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <Link href="/projects" className="text-lg font-bold hover:underline">
          Promo Studio
        </Link>
        <UserMenu email={userEmail} />
      </div>

      <div className="mt-6">
        <h1 className="text-2xl font-bold">Start from a template</h1>
        <p className="mt-1 text-[13.5px] text-neutral-500 dark:text-neutral-400">Pick a style, drop in your screenshots, and you&apos;re editing a finished promo in seconds.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setOpenId(t.id)}
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
              <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">{t.description}</p>
              {(t.durationSeconds || t.slotCount) && (
                <p className="mt-1.5 text-[11.5px] font-semibold text-neutral-400 dark:text-neutral-500">
                  {t.durationSeconds ? `${Math.round(t.durationSeconds)}s` : null}
                  {t.durationSeconds && t.slotCount ? ' · ' : null}
                  {t.slotCount ? `${t.slotCount} screenshot${t.slotCount === 1 ? '' : 's'}` : null}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {templates.length === 0 && <p className="mt-8 text-center text-[14px] text-neutral-500 dark:text-neutral-400">No templates available right now.</p>}

      {openId && <TemplateWizard templateId={openId} onClose={() => setOpenId(null)} />}
    </main>
  );
}
