'use client';

import { useEffect, useMemo, useState } from 'react';

import '@/engine2/builtInRecipes';
import { PALS } from '@/engine2/palettes';
import { listRecipes, type RecipeContent } from '@/engine2/recipes';
import { generateVariations, type RemixOptions } from '@/engine2/remix';
import { buildSampleScreenshots } from '@/engine2/sampleContent';
import { STYLES, type StyleId } from '@/engine2/styles';
import type { SceneProjectV2 } from '@/engine2/types';
import RecipePreview from '@/components/dev/RecipePreview';

type AppChoice = 'fitness' | 'shopping';

/**
 * /dev/recipes — Prompt 6's proof: pick a recipe + style, hit Remix to get
 * 4 seeded variations side by side, lock the parts you like, remix again.
 * Switching the "app" (two procedurally-distinct sample screenshot sets,
 * sampleContent.ts) with the *same* recipe/style/seed is the direct
 * demonstration that two different apps look clearly different through it.
 */
export default function RecipesDevPage() {
  const recipes = useMemo(() => listRecipes(), []);
  // buildSampleScreenshots() needs canvas APIs, unavailable during Next's
  // server render of this client component — built client-only, after
  // mount, same as /dev/engine's demo-project init.
  const [samples, setSamples] = useState<ReturnType<typeof buildSampleScreenshots> | null>(null);
  useEffect(() => {
    // One-time client-only init (canvas APIs, unavailable during SSR) —
    // same pattern /dev/engine's page uses for its own demo-project init.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSamples(buildSampleScreenshots());
  }, []);

  const [appChoice, setAppChoice] = useState<AppChoice>('fitness');
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? '');
  const [styleId, setStyleId] = useState<StyleId>('playful');
  const [paletteId, setPaletteId] = useState<keyof typeof PALS>('aurora');
  const [seed, setSeed] = useState(1);
  const [locks, setLocks] = useState({ palette: false, motion: false, layout: false });
  const [variations, setVariations] = useState<SceneProjectV2[]>([]);

  const shot = samples?.[appChoice];
  const content: RecipeContent = useMemo(
    () => ({ screenshots: shot ? [shot] : [], texts: [], appName: appChoice === 'fitness' ? 'Pace' : 'Marketplace' }),
    [shot, appChoice],
  );
  const assets = useMemo(() => (shot ? { [shot.id]: shot.image } : {}), [shot]);

  if (!samples || !shot) {
    return (
      <div style={{ minHeight: '100vh', background: '#0B0B10', color: '#888', padding: 24, fontFamily: 'system-ui, sans-serif' }}>Loading…</div>
    );
  }

  const remix = () => {
    // Layout locked -> reuse the current base seed (so variant 0's layout
    // stays put); unlocked -> roll a fresh one, same as every other
    // unlocked part does inside remixOne().
    const baseSeed = locks.layout ? seed : Math.floor(Math.random() * 1_000_000);
    const opts: RemixOptions = { recipeId, content, seed: baseSeed, paletteId, styleId, locks };
    const next = generateVariations(opts, 4);
    setVariations(next);
    setSeed(next[0].seed);
    setStyleId(next[0].styleId);
    setPaletteId(next[0].paletteId as keyof typeof PALS);
  };

  const keep = (v: SceneProjectV2, index: number) => {
    setSeed(v.seed);
    setStyleId(v.styleId);
    setPaletteId(v.paletteId as keyof typeof PALS);
    setVariations((prev) => {
      const next = [...prev];
      next[0] = v;
      return next;
    });
    void index;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0B0B10', color: '#fff', fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Scene Recipes & Remix</h1>
      <p style={{ fontSize: 13, color: '#9BA1B0', margin: '0 0 16px' }}>Same recipe, same style — switch the app to see the pixels (and choices) differ. Remix to roll new variations.</p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <label style={ctlLabel}>
          App
          <select value={appChoice} onChange={(e) => setAppChoice(e.target.value as AppChoice)} style={ctlInput}>
            <option value="fitness">Fitness tracker</option>
            <option value="shopping">Shopping app</option>
          </select>
        </label>
        <label style={ctlLabel}>
          Recipe
          <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} style={ctlInput}>
            {recipes.map((r) => (
              <option key={r.id} value={r.id} title={r.description}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label style={ctlLabel}>
          Style
          <select value={styleId} onChange={(e) => setStyleId(e.target.value as StyleId)} style={ctlInput}>
            {Object.keys(STYLES).map((id) => (
              <option key={id} value={id}>
                {STYLES[id].label}
              </option>
            ))}
          </select>
        </label>
        <label style={ctlLabel}>
          Palette
          <select value={paletteId} onChange={(e) => setPaletteId(e.target.value as keyof typeof PALS)} style={ctlInput}>
            {Object.keys(PALS).map((id) => (
              <option key={id} value={id}>
                {PALS[id as keyof typeof PALS].label}
              </option>
            ))}
          </select>
        </label>
        <button onClick={remix} style={{ border: 0, borderRadius: 8, padding: '8px 16px', fontWeight: 700, background: '#6D5BFF', color: '#fff' }}>
          ✨ Remix (4 variations)
        </button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 12.5 }}>
        {(['palette', 'motion', 'layout'] as const).map((k) => (
          <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={locks[k]} onChange={(e) => setLocks((prev) => ({ ...prev, [k]: e.target.checked }))} />
            Lock {k}
          </label>
        ))}
        <span style={{ opacity: 0.5 }}>Locked parts carry over into the next Remix instead of re-rolling.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
        {variations.length === 0 && <p style={{ opacity: 0.5, fontSize: 13 }}>Hit Remix to generate variations.</p>}
        {variations.map((v, i) => (
          <div key={i} style={{ background: '#15151C', borderRadius: 12, padding: 10 }}>
            <RecipePreview project={v} assets={assets} />
            <div style={{ fontSize: 11, color: '#9BA1B0', marginTop: 6 }}>
              {PALS[v.paletteId as keyof typeof PALS]?.label} · {STYLES[v.styleId]?.label} · seed {v.seed}
            </div>
            <button onClick={() => keep(v, i)} style={{ marginTop: 6, fontSize: 11, width: '100%', border: '1px solid #33333f', borderRadius: 6, padding: '4px 0', background: '#1A1A22', color: '#fff' }}>
              Keep this
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const ctlLabel = { display: 'flex', flexDirection: 'column' as const, gap: 4, fontSize: 11, color: '#9BA1B0' };
const ctlInput = { background: '#1A1A22', color: '#fff', border: '1px solid #33333f', borderRadius: 6, padding: '6px 8px', fontSize: 12.5 };
