'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createClient } from '@/lib/supabase/client';
import { duplicateTemplate, setTemplateStatus, softDeleteTemplate, type TemplateStatus } from '@/lib/supabase/templates';

export interface TemplateRow {
  id: string;
  slug: string | null;
  name: string | null;
  category: string | null;
  status: TemplateStatus;
  duration_seconds: number | null;
  slot_count: number | null;
  swatch_a: string | null;
  swatch_b: string | null;
  preview_video_9x16_url: string | null;
  sort_order: number;
}

export default function TemplatesTable({ initialTemplates }: { initialTemplates: TemplateRow[] }) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [busyId, setBusyId] = useState<string | null>(null);

  const togglePublish = async (row: TemplateRow) => {
    const next: TemplateStatus = row.status === 'published' ? 'draft' : 'published';
    setTemplates((prev) => prev.map((t) => (t.id === row.id ? { ...t, status: next } : t)));
    try {
      await setTemplateStatus(createClient(), row.id, next);
    } catch (err) {
      console.error('[admin] publish toggle failed', err);
      setTemplates((prev) => prev.map((t) => (t.id === row.id ? { ...t, status: row.status } : t)));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= templates.length) return;
    const a = templates[index];
    const b = templates[target];
    const reordered = [...templates];
    reordered[index] = { ...b, sort_order: a.sort_order };
    reordered[target] = { ...a, sort_order: b.sort_order };
    setTemplates(reordered);
    const supabase = createClient();
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('templates').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('templates').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    if (e1 || e2) {
      console.error('[admin] reorder failed', e1 ?? e2);
      setTemplates(templates);
    }
  };

  const duplicate = async (row: TemplateRow) => {
    setBusyId(row.id);
    try {
      const newId = await duplicateTemplate(createClient(), row.id);
      router.push(`/admin/templates/${newId}/edit`);
    } catch (err) {
      console.error('[admin] duplicate failed', err);
      setBusyId(null);
    }
  };

  const remove = async (row: TemplateRow) => {
    if (!confirm(`Delete "${row.name}"? This can be undone in the database but not from this screen.`)) return;
    const prev = templates;
    setTemplates((p) => p.filter((t) => t.id !== row.id));
    try {
      await softDeleteTemplate(createClient(), row.id);
    } catch (err) {
      console.error('[admin] delete failed', err);
      setTemplates(prev);
    }
  };

  return (
    <div className="mt-5 grid gap-2">
      {templates.map((row, i) => (
        <div key={row.id} className="flex items-center gap-3 rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
          <div
            className="h-[54px] w-[36px] shrink-0 overflow-hidden rounded-lg bg-cover bg-center"
            style={{ background: row.preview_video_9x16_url ? undefined : `linear-gradient(135deg, ${row.swatch_a ?? '#3347FF'}, ${row.swatch_b ?? '#0C1662'})` }}
          >
            {row.preview_video_9x16_url && <video src={row.preview_video_9x16_url} className="h-full w-full object-cover" muted playsInline />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14px] font-bold">{row.name || row.id}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${row.status === 'published' ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' : 'bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400'}`}>{row.status}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-neutral-500 dark:text-neutral-400">
              {row.category || '—'} · {row.duration_seconds ? `${Math.round(row.duration_seconds)}s` : '—'} · {row.slot_count ?? '—'} slot{row.slot_count === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded-lg border border-black/10 px-2 py-1.5 text-[12px] font-bold disabled:opacity-30 dark:border-white/10">
              ↑
            </button>
            <button onClick={() => move(i, 1)} disabled={i === templates.length - 1} className="rounded-lg border border-black/10 px-2 py-1.5 text-[12px] font-bold disabled:opacity-30 dark:border-white/10">
              ↓
            </button>
            <Link href={`/admin/templates/${row.id}/edit`} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-bold dark:border-white/10">
              Edit
            </Link>
            <button onClick={() => duplicate(row)} disabled={busyId === row.id} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-bold disabled:opacity-50 dark:border-white/10">
              {busyId === row.id ? '…' : 'Duplicate'}
            </button>
            <button onClick={() => togglePublish(row)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-bold dark:border-white/10">
              {row.status === 'published' ? 'Unpublish' : 'Publish'}
            </button>
            <button onClick={() => remove(row)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[12px] font-bold text-red-600 dark:border-white/10">
              Delete
            </button>
          </div>
        </div>
      ))}
      {templates.length === 0 && <p className="text-[13px] text-neutral-500 dark:text-neutral-400">No templates yet — run scripts/import-templates-to-db.ts.</p>}
    </div>
  );
}
