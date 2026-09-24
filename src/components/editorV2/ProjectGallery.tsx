'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { instantiateTemplate } from '@/engine2/player';
import { checkoutTemplate } from '@/engine2/templates/checkout';
import { insightsTemplate } from '@/engine2/templates/insights';
import { reactionsTemplate } from '@/engine2/templates/reactions';
import { showcaseTemplate } from '@/engine2/templates/showcase';
import type { TemplateRecipeV2 } from '@/engine2/types';
import UserMenu from '@/components/auth/UserMenu';
import { createClient } from '@/lib/supabase/client';
import { createProjectV2, deleteProjectV2, duplicateProjectV2, getProjectV2, listAllProjects, renameProjectV2, type ProjectV2ListItem } from '@/lib/supabase/projectsV2';

const TEMPLATES: TemplateRecipeV2[] = [reactionsTemplate, checkoutTemplate, insightsTemplate, showcaseTemplate];

const card = { background: '#15151c', border: '1px solid #262632', borderRadius: 12, padding: 16, cursor: 'pointer', color: '#fff', textAlign: 'left' as const, display: 'flex', flexDirection: 'column' as const, gap: 4 };
const btn = { fontSize: 11.5, padding: '6px 10px', borderRadius: 8, border: '1px solid #33333f', background: '#1A1A22', color: '#fff', cursor: 'pointer' } as const;

// Outside the component so the linter's purity check can't mistake this
// for something called during render — it only ever runs from the
// startNew() click handler below.
function randomSeed(): number {
  return Math.floor(Math.random() * 1_000_000);
}

/**
 * Tier 1 item 3 — the `/editor2` start screen: "New project" (one of the
 * hand-authored templates — reactions/checkout/insights/showcase), plus
 * every saved project (src/lib/supabase/projectsV2.ts — real Supabase
 * persistence as of the infrastructure merge, replacing the earlier
 * localStorage-only version) with rename/duplicate/delete.
 *
 * Also lists classic-engine projects as "Legacy" (migration decision: no
 * auto-conversion between the two data models — see the Tier-1 merge
 * report). They link to their own still-fully-functional /editor/[id]
 * route rather than being made artificially read-only right now, since
 * the classic engine hasn't been deleted and genuinely still edits them
 * normally; a real read-only "export as-is" viewer is deferred to the
 * point where classic actually gets retired (its own explicit checkpoint,
 * not part of this merge).
 */
export default function ProjectGallery({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectV2ListItem[] | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    const supabase = createClient();
    setProjects(await listAllProjects(supabase));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client-only load, mirrors this codebase's other client-data-fetch pages
    void refresh();
  }, []);

  const startNew = async (template: TemplateRecipeV2) => {
    setError('');
    setCreating(true);
    try {
      const supabase = createClient();
      const project = instantiateTemplate(template, { styleId: 'playful', paletteId: 'aurora', seed: randomSeed() });
      const row = await createProjectV2(supabase, template.label, project);
      router.push(`/editor2/${row.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a new project.');
      setCreating(false);
    }
  };

  const commitRename = async (id: string) => {
    setRenamingId(null);
    if (!renameValue.trim()) return;
    const supabase = createClient();
    await renameProjectV2(supabase, id, renameValue.trim());
    await refresh();
  };

  if (!projects) return <div style={{ color: '#888', padding: 24 }}>Loading…</div>;

  const v2Projects = projects.filter((p) => p.engine === 'v2');
  const legacyProjects = projects.filter((p) => p.engine === 'classic');

  return (
    <div style={{ minHeight: '100vh', background: '#0B0B10', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Promo Studio</h1>
        <UserMenu email={userEmail} />
      </div>

      <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, margin: '0 0 10px' }}>New project</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, maxWidth: 900, marginBottom: 12 }}>
        {TEMPLATES.map((t) => (
          <button key={t.id} style={{ ...card, opacity: creating ? 0.5 : 1, cursor: creating ? 'default' : 'pointer' }} disabled={creating} onClick={() => startNew(t)}>
            <strong style={{ fontSize: 14 }}>{t.label}</strong>
            <span style={{ fontSize: 12, opacity: 0.6 }}>{t.sub}</span>
          </button>
        ))}
      </div>
      {error && <p style={{ fontSize: 12, color: '#ff8a8a', margin: '0 0 20px' }}>{error}</p>}
      {!error && <div style={{ marginBottom: 36 }} />}

      <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, margin: '0 0 10px' }}>Your projects</h2>
      {v2Projects.length === 0 ? (
        <p style={{ opacity: 0.5, fontSize: 13, marginBottom: 24 }}>No saved projects yet — start one above.</p>
      ) : (
        <div style={{ display: 'grid', gap: 8, maxWidth: 700, marginBottom: 24 }}>
          {v2Projects.map((p) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#15151c', border: '1px solid #262632', borderRadius: 10, padding: '10px 14px' }}>
              {renamingId === p.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => void commitRename(p.id)}
                  onKeyDown={(e) => e.key === 'Enter' && commitRename(p.id)}
                  style={{ flex: 1, background: '#1A1A22', color: '#fff', border: '1px solid #33333f', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
                />
              ) : (
                <button onClick={() => router.push(`/editor2/${p.id}`)} style={{ flex: 1, textAlign: 'left', background: 'none', border: 0, color: '#fff', fontSize: 13, cursor: 'pointer', padding: 0 }}>
                  {p.name}
                  <span style={{ opacity: 0.5, fontSize: 11, marginLeft: 8 }}>{new Date(p.updated_at).toLocaleString()}</span>
                </button>
              )}
              <button
                style={btn}
                onClick={() => {
                  setRenamingId(p.id);
                  setRenameValue(p.name);
                }}
              >
                Rename
              </button>
              <button
                style={btn}
                onClick={async () => {
                  const supabase = createClient();
                  const row = await getProjectV2(supabase, p.id);
                  if (row) {
                    await duplicateProjectV2(supabase, row);
                    await refresh();
                  }
                }}
              >
                Duplicate
              </button>
              <button
                style={{ ...btn, color: '#ff8a8a' }}
                onClick={async () => {
                  if (confirm(`Delete "${p.name}"? This can't be undone.`)) {
                    const supabase = createClient();
                    await deleteProjectV2(supabase, p.id);
                    await refresh();
                  }
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {legacyProjects.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6, margin: '0 0 4px' }}>Legacy projects</h2>
          <p style={{ fontSize: 12, opacity: 0.5, margin: '0 0 10px', maxWidth: 560 }}>
            Made with the classic editor, before this one existed — they don&apos;t open here since the two use different, incompatible project formats. They still open and edit normally in the classic editor.
          </p>
          <div style={{ display: 'grid', gap: 8, maxWidth: 700 }}>
            {legacyProjects.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#15151c', border: '1px solid #262632', borderRadius: 10, padding: '10px 14px', opacity: 0.85 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#FFE066', background: '#2A2410', borderRadius: 4, padding: '2px 6px' }}>Legacy</span>
                <a href={`/editor/${p.id}`} style={{ flex: 1, color: '#fff', fontSize: 13, textDecoration: 'none' }}>
                  {p.name}
                  <span style={{ opacity: 0.5, fontSize: 11, marginLeft: 8 }}>{new Date(p.updated_at).toLocaleString()}</span>
                </a>
                <a href={`/editor/${p.id}`} style={{ ...btn, textDecoration: 'none', display: 'inline-block' }}>
                  Open in classic editor
                </a>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
