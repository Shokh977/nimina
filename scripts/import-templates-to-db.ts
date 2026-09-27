/**
 * One-time import of every code-defined template (the 6-template starter
 * set + the 7-template Nimina Template Pack — src/engine/templates/index.ts's
 * full `TEMPLATES` array, 13 total) into the `templates` table's `data`
 * jsonb column, plus a version-1 row in `template_versions` for each.
 *
 * The spec this implements only named "the 7 existing code templates," but
 * the starter set is also live in the gallery today (via listEnabledTemplates's
 * default-enabled merge) with no DB row of its own — importing only 7 would
 * make those 6 silently vanish once the gallery reads from the DB
 * exclusively, which fails the spec's own "verify the gallery behaves
 * identically after the switch" requirement. So this imports all 13.
 *
 * After this runs and src/lib/supabase/templates.ts is rewired to read
 * `data` from the DB, the code template files remain in the repo only as
 * this script's seed source and as the source of buildSampleAssets() for
 * procedural placeholder/preview-render images — no longer imported by any
 * live gallery/wizard page.
 *
 * Run with:
 *   npx tsx scripts/import-templates-to-db.ts
 *
 * (Plain `node --env-file=... scripts/....ts` doesn't work here, unlike
 * scripts/seed-music-library.ts — this script pulls in the whole template
 * engine via src/engine/templates/index.ts, which uses extensionless
 * relative imports throughout (normal for a bundler, not resolvable by
 * Node's own ESM loader even with type-stripping). tsx handles both the TS
 * transform and that resolution.)
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local (loaded below via process.loadEnvFile, since tsx doesn't read
 * --env-file itself). Safe to re-run (upserts by id; version numbers only
 * advance past what's already in template_versions for that id).
 */
import { createClient } from '@supabase/supabase-js';

import { TEMPLATES } from '../src/engine/templates/index.ts';
import { slugify, uniqueSlug } from '../src/lib/slug.ts';

process.loadEnvFile('.env.local');

// Fields that legitimately differ between the full and short builds — every
// other field must deep-equal, or the "short cut is just a scene subset"
// assumption (src/lib/templateShortVariant.ts) doesn't hold for this
// template and needs a human look before importing.
const VARIABLE_TOP_LEVEL_KEYS = new Set(['scenes', 'intro']);

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function assertOnlySceneAndIntroDiffer(id: string, full: Record<string, unknown>, short: Record<string, unknown>) {
  const keys = new Set([...Object.keys(full), ...Object.keys(short)]);
  for (const key of keys) {
    if (VARIABLE_TOP_LEVEL_KEYS.has(key)) continue;
    if (!deepEqual(full[key], short[key])) {
      throw new Error(`[${id}] short vs full build differ in "${key}" — the "short cut is just a scene subset" assumption doesn't hold for this template, needs a human look before importing.`);
    }
  }
  if (!deepEqual(full.intro && (full.intro as { dur: number }).dur, short.intro && (short.intro as { dur: number }).dur)) {
    throw new Error(`[${id}] short vs full build differ in "intro.dur" (only "intro.on" is expected to vary).`);
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. Run with: node --env-file=.env.local scripts/import-templates-to-db.ts');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: existingRows, error: existingErr } = await supabase.from('templates').select('id, status, sort_order, slug');
  if (existingErr) throw existingErr;
  const existingById = new Map((existingRows ?? []).map((r) => [r.id as string, r]));
  const takenSlugs = new Set((existingRows ?? []).map((r) => r.slug as string).filter(Boolean));

  let failed = 0;

  for (let i = 0; i < TEMPLATES.length; i++) {
    const def = TEMPLATES[i];
    try {
      const full = def.build({ variant: 'full' });
      const short = def.build({ variant: 'short' });
      assertOnlySceneAndIntroDiffer(def.id, full.project as unknown as Record<string, unknown>, short.project as unknown as Record<string, unknown>);

      const shortVariant = {
        sceneIds: short.project.scenes.map((s) => s.id),
        introOn: short.project.intro.on,
      };

      const existing = existingById.get(def.id);
      const slug = existing?.slug ?? uniqueSlug(slugify(def.name), takenSlugs);
      takenSlugs.add(slug);

      const { error: upsertErr } = await supabase.from('templates').upsert({
        id: def.id,
        slug,
        name: def.name,
        description: def.description,
        category: def.category,
        status: existing?.status ?? 'published',
        sort_order: existing?.sort_order ?? i,
        duration_seconds: def.durationSeconds,
        slot_count: full.slots.length,
        data: { project: full.project, slots: full.slots, shortVariant },
        sample_assets_source_id: def.id,
        swatch_a: def.swatch[0],
        swatch_b: def.swatch[1],
        updated_at: new Date().toISOString(),
      });
      if (upsertErr) throw upsertErr;

      const { data: maxVersionRow } = await supabase.from('template_versions').select('version').eq('template_id', def.id).order('version', { ascending: false }).limit(1).maybeSingle();
      const nextVersion = (maxVersionRow?.version ?? 0) + 1;
      const { error: versionErr } = await supabase.from('template_versions').insert({
        template_id: def.id,
        version: nextVersion,
        data: { project: full.project, slots: full.slots, shortVariant },
        created_by: null,
      });
      if (versionErr) throw versionErr;

      console.log(`[ok] ${def.id} (slug: ${slug}, version ${nextVersion}, ${full.slots.length} slots, ${shortVariant.sceneIds.length}/${full.project.scenes.length} scenes in short cut)`);
    } catch (err) {
      failed++;
      console.error(`[fail] ${def.id}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nImported ${TEMPLATES.length - failed}/${TEMPLATES.length} template(s).`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
