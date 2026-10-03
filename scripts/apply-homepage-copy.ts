/**
 * Writes the homepage copy in src/lib/siteContent.ts (DEFAULT_SITE_CONTENT)
 * into the `site_content` table, which is what the live homepage reads —
 * the database rows override the code defaults, so changing the defaults
 * alone doesn't change the site.
 *
 * Keeps what an admin chose and the copy doesn't decide: the hero's
 * featured template, every button/link target (…Href), and each pricing
 * plan's price and suffix (matched by plan name). Rows for sections the
 * homepage no longer shows are left alone.
 *
 * Dry run by default (prints what would change):
 *   node --env-file=.env.local scripts/apply-homepage-copy.ts
 *   node --env-file=.env.local scripts/apply-homepage-copy.ts --apply
 */
import { createClient } from '@supabase/supabase-js';

import { DEFAULT_SITE_CONTENT, SITE_CONTENT_KEYS } from '../src/lib/siteContent.ts';

type Json = Record<string, unknown>;

function keepAdminChoices(key: string, next: Json, current: Json | undefined): Json {
  if (!current) return next;
  const out: Json = { ...next };
  for (const [k, v] of Object.entries(current)) if (k.endsWith('Href') && typeof v === 'string' && v) out[k] = v;
  if (key === 'hero' && current.featuredTemplateId) out.featuredTemplateId = current.featuredTemplateId;
  if (key === 'pricing' && Array.isArray(current.plans)) {
    const old = new Map((current.plans as Json[]).map((p) => [p.name, p]));
    out.plans = (next.plans as Json[]).map((p) => {
      const o = old.get(p.name);
      return o ? { ...p, price: o.price ?? p.price, suffix: o.suffix ?? p.suffix } : p;
    });
  }
  return out;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Run with --env-file=.env.local (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY).');
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await supabase.from('site_content').select('key, data');
  if (error) throw error;
  const current = new Map((data ?? []).map((r) => [r.key as string, r.data as Json]));

  for (const section of SITE_CONTENT_KEYS) {
    const next = keepAdminChoices(section, DEFAULT_SITE_CONTENT[section] as unknown as Json, current.get(section));
    const changed = JSON.stringify(next) !== JSON.stringify(current.get(section));
    console.log(`${changed ? 'update' : 'same  '} ${section}`);
    if (changed && apply) {
      const { error: e } = await supabase.from('site_content').upsert({ key: section, data: next, updated_at: new Date().toISOString() });
      if (e) throw e;
    }
  }
  console.log(apply ? 'Applied.' : 'Dry run — add --apply to write.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
