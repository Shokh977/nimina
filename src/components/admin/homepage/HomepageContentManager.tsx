'use client';

import { useState } from 'react';

import { DEFAULT_SITE_CONTENT, SITE_CONTENT_KEYS, type SiteContentKey } from '@/lib/siteContent';
import { SITE_CONTENT_SCHEMA } from '@/lib/siteContentSchema';
import { createClient } from '@/lib/supabase/client';
import SectionEditor from './SectionEditor';

interface Row {
  key: string;
  data: Record<string, unknown>;
}

/** One tab per homepage section, each a schema-driven SectionEditor with
 * its own Save button — editing one section can't clobber another's
 * unsaved changes, and each section is its own `site_content` row. Missing
 * rows (a fresh install before this ships, or a row an admin never
 * touched) fall back to DEFAULT_SITE_CONTENT, same as the live homepage's
 * own getSiteContent(). */
export default function HomepageContentManager({ initialRows, templates }: { initialRows: Row[]; templates: { id: string; name: string }[] }) {
  const [content, setContent] = useState<Record<SiteContentKey, Record<string, unknown>>>(() =>
    SITE_CONTENT_KEYS.reduce(
      (acc, key) => {
        const row = initialRows.find((r) => r.key === key);
        acc[key] = { ...(DEFAULT_SITE_CONTENT[key] as object), ...(row?.data ?? {}) };
        return acc;
      },
      {} as Record<SiteContentKey, Record<string, unknown>>,
    ),
  );
  const [active, setActive] = useState<SiteContentKey>('hero');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const schema = SITE_CONTENT_SCHEMA.find((s) => s.key === active)!;

  const save = async () => {
    setStatus('saving');
    const { error } = await createClient()
      .from('site_content')
      .upsert({ key: active, data: content[active], updated_at: new Date().toISOString() });
    setStatus(error ? 'error' : 'saved');
    if (error) console.error('[admin] site content save failed', error);
  };

  return (
    <div className="mt-5">
      <div className="flex flex-wrap gap-1.5 border-b border-black/10 pb-3 dark:border-white/10">
        {SITE_CONTENT_SCHEMA.map((s) => (
          <button
            key={s.key}
            onClick={() => {
              setActive(s.key);
              setStatus('idle');
            }}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold ${active === s.key ? 'bg-indigo-600 text-white' : 'text-neutral-500 hover:bg-black/5 dark:text-neutral-400 dark:hover:bg-white/5'}`}
          >
            {s.title}
          </button>
        ))}
      </div>

      <div className="mt-5 max-w-[640px]">
        <SectionEditor schema={schema} data={content[active]} onChange={(d) => setContent((c) => ({ ...c, [active]: d }))} templates={templates} />

        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={status === 'saving'} className="rounded-xl bg-indigo-600 px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50">
            {status === 'saving' ? 'Saving…' : 'Save'}
          </button>
          {status === 'saved' && <span className="text-[12.5px] font-semibold text-green-600 dark:text-green-400">Saved</span>}
          {status === 'error' && <span className="text-[12.5px] font-semibold text-red-600">Save failed — check console</span>}
        </div>
      </div>
    </div>
  );
}
