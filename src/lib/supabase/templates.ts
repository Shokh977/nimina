import type { SupabaseClient } from '@supabase/supabase-js';

import type { TemplateSlot } from '@/engine/templates';
import type { Project } from '@/engine/types';
import { applyShortVariant, type ShortVariant } from '@/lib/templateShortVariant';
import { slugify, uniqueSlug } from '@/lib/slug';
import { duplicateProjectAssets } from './storage';

export interface TemplateData {
  project: Project;
  slots: TemplateSlot[];
  shortVariant: ShortVariant;
}

export type TemplateStatus = 'draft' | 'published';

/** Shape the gallery (`src/app/templates/page.tsx`) and the wizard
 * (`TemplateWizard.tsx`) consume — a `build()`-shaped function backed by
 * the DB row's `data` jsonb instead of a code file, so an admin's edit
 * (`/admin/templates/[id]/edit`) reaches both without a deploy. */
export interface TemplateWithPreview {
  id: string;
  name: string;
  description: string;
  category: string;
  swatch: [string, string];
  durationSeconds: number;
  previewVideo9x16?: string;
  previewVideo16x9?: string;
  build: (opts?: { variant?: 'full' | 'short' }) => { project: Project; slots: TemplateData['slots'] };
}

/** Plain, serializable subset of TemplateWithPreview — for passing real
 * template rows from a Server Component into a Client Component (e.g. the
 * homepage's TemplateLibrary, the dashboard's TemplateStrip). `build` is a
 * function and can't cross that boundary; nothing that renders a card
 * needs it anyway. */
export interface MarketingTemplateCard {
  id: string;
  name: string;
  description: string;
  category: string;
  swatch: [string, string];
  durationSeconds: number;
  previewVideo9x16?: string;
}

export function toMarketingCard(t: TemplateWithPreview): MarketingTemplateCard {
  return { id: t.id, name: t.name, description: t.description, category: t.category, swatch: t.swatch, durationSeconds: t.durationSeconds, previewVideo9x16: t.previewVideo9x16 };
}

function rowToTemplate(row: {
  id: string;
  name: string | null;
  description: string | null;
  category: string | null;
  swatch_a: string | null;
  swatch_b: string | null;
  duration_seconds: number | null;
  data: TemplateData;
  preview_video_9x16_url: string | null;
  preview_video_16x9_url: string | null;
}): TemplateWithPreview {
  return {
    id: row.id,
    name: row.name ?? '',
    description: row.description ?? '',
    category: row.category ?? '',
    swatch: [row.swatch_a ?? '#3347FF', row.swatch_b ?? '#0C1662'],
    durationSeconds: row.duration_seconds ?? 0,
    previewVideo9x16: row.preview_video_9x16_url ?? undefined,
    previewVideo16x9: row.preview_video_16x9_url ?? undefined,
    build: (opts) => {
      if (opts?.variant === 'short') {
        return { project: applyShortVariant(row.data.project, row.data.shortVariant), slots: row.data.slots };
      }
      return { project: row.data.project, slots: row.data.slots };
    },
  };
}

const ROW_FIELDS = 'id, name, description, category, swatch_a, swatch_b, duration_seconds, data, preview_video_9x16_url, preview_video_16x9_url';

/** Published, non-deleted templates in gallery order — what `/templates`
 * and the wizard's template picker show. RLS (0013_template_editor.sql)
 * already restricts anonymous/non-admin reads to published rows; this
 * query's own filter keeps intent explicit and matches for an admin
 * session too (which can otherwise see drafts). */
export async function listEnabledTemplates(supabase: SupabaseClient): Promise<TemplateWithPreview[]> {
  const { data } = await supabase.from('templates').select(ROW_FIELDS).eq('status', 'published').is('deleted_at', null).order('sort_order');
  return (data ?? []).map(rowToTemplate);
}

/** One template by id, for the wizard — RLS naturally scopes this to
 * published rows for a normal user (drafts 404 the same way a missing row
 * would) while still letting an admin preview/test a draft directly. */
export async function getTemplateForWizard(supabase: SupabaseClient, id: string): Promise<TemplateWithPreview | null> {
  const { data } = await supabase.from('templates').select(ROW_FIELDS).eq('id', id).is('deleted_at', null).maybeSingle();
  return data ? rowToTemplate(data) : null;
}

export async function setTemplateStatus(supabase: SupabaseClient, id: string, status: TemplateStatus): Promise<void> {
  const { error } = await supabase.from('templates').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function softDeleteTemplate(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('templates').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/** Copies a template's row (new id/slug, status reset to draft) plus its
 * version-1 history entry and any real uploaded assets (placeholder
 * images an admin already replaced during editing) — mirrors
 * "Duplicate project"'s use of the same underlying storage helper. */
export async function duplicateTemplate(supabase: SupabaseClient, sourceId: string): Promise<string> {
  const { data: source, error: sourceErr } = await supabase.from('templates').select('*').eq('id', sourceId).single();
  if (sourceErr) throw sourceErr;

  const { data: existing } = await supabase.from('templates').select('id, slug');
  const takenIds = new Set((existing ?? []).map((r) => r.id as string));
  const takenSlugs = new Set((existing ?? []).map((r) => r.slug as string).filter(Boolean));
  const base = slugify(`${source.name as string} copy`);
  const newId = uniqueSlug(base, takenIds);
  const newSlug = uniqueSlug(base, takenSlugs);

  const { error: insertErr } = await supabase.from('templates').insert({
    id: newId,
    slug: newSlug,
    name: `${source.name as string} copy`,
    description: source.description,
    category: source.category,
    status: 'draft',
    sort_order: (source.sort_order as number) ?? 0,
    duration_seconds: source.duration_seconds,
    slot_count: source.slot_count,
    data: source.data,
    sample_assets_source_id: source.sample_assets_source_id,
    swatch_a: source.swatch_a,
    swatch_b: source.swatch_b,
  });
  if (insertErr) throw insertErr;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error: versionErr } = await supabase.from('template_versions').insert({ template_id: newId, version: 1, data: source.data, created_by: user?.id ?? null });
  if (versionErr) throw versionErr;

  await duplicateProjectAssets(supabase, sourceId, newId);

  return newId;
}
