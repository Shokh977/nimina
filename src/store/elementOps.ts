import type { ElementKey, ElementMap, ElementXform, TextLayer } from '@/engine/elements';
import type { IntroConfig, OutroConfig, Project, Slide } from '@/engine/types';

/** Which segment an element belongs to: the intro, the outro, or a slide id. */
export type ElementOwner = 'intro' | 'outro' | number;

// Story slides have no elements; the fields are simply absent there.
type Owner = (IntroConfig | OutroConfig | Slide) & { elements?: ElementMap; texts?: TextLayer[] };

export function getOwner(p: Project, owner: ElementOwner): Owner | undefined {
  return owner === 'intro' ? p.intro : owner === 'outro' ? p.outro : p.scenes.find((s) => s.id === owner);
}

function mapOwner(p: Project, owner: ElementOwner, fn: (o: Owner) => Owner): Project {
  if (owner === 'intro') return { ...p, intro: fn(p.intro) as IntroConfig };
  if (owner === 'outro') return { ...p, outro: fn(p.outro) as OutroConfig };
  return { ...p, scenes: p.scenes.map((s) => (s.id === owner ? (fn(s) as Slide) : s)) };
}

function clean(xf: ElementXform): ElementXform | undefined {
  const out: ElementXform = {};
  for (const [k, v] of Object.entries(xf) as Array<[keyof ElementXform, number | undefined]>) if (v !== undefined && Number.isFinite(v)) out[k] = v;
  return Object.keys(out).length ? out : undefined;
}

/** Merges overrides (null removes an element's override entirely). */
export function setXforms(p: Project, owner: ElementOwner, patch: Partial<Record<ElementKey, ElementXform | null>>): Project {
  return mapOwner(p, owner, (o) => {
    const els: ElementMap = { ...(o.elements ?? {}) };
    for (const [key, xf] of Object.entries(patch) as Array<[ElementKey, ElementXform | null]>) {
      const next = xf === null ? undefined : clean({ ...els[key], ...xf });
      if (next) els[key] = next;
      else delete els[key];
    }
    return { ...o, elements: els };
  });
}

/** The text an element shows (text elements only). */
export function textOf(p: Project, owner: ElementOwner, key: ElementKey): string | null {
  const o = getOwner(p, owner);
  if (!o) return null;
  if (key.startsWith('text:')) return o.texts?.find((t) => `text:${t.id}` === key)?.text ?? null;
  if (owner === 'intro') return key === 'headline' ? p.appName : key === 'sub' ? p.intro.tagline : null;
  if (owner === 'outro') return key === 'headline' ? p.outro.cta : key === 'sub' ? p.outro.small : null;
  const s = o as Slide;
  if (s.kind === 'story') return null;
  return key === 'headline' ? s.headline : key === 'sub' ? s.sub : null;
}

export function setTextOf(p: Project, owner: ElementOwner, key: ElementKey, text: string): Project {
  if (key.startsWith('text:')) return mapOwner(p, owner, (o) => ({ ...o, texts: (o.texts ?? []).map((t) => (`text:${t.id}` === key ? { ...t, text } : t)) }));
  if (owner === 'intro') return key === 'headline' ? { ...p, appName: text } : key === 'sub' ? { ...p, intro: { ...p.intro, tagline: text } } : p;
  if (owner === 'outro') return key === 'headline' ? { ...p, outro: { ...p.outro, cta: text } } : key === 'sub' ? { ...p, outro: { ...p.outro, small: text } } : p;
  return mapOwner(p, owner, (o) => (key === 'headline' ? { ...o, headline: text } : key === 'sub' ? { ...o, sub: text } : o));
}

/** Removes an element: clears its content (headline, badge, …) or deletes
 * the text box, and drops its override. The device and app icon can't be
 * removed (deletable: false in the report). */
export function deleteElement(p: Project, owner: ElementOwner, key: ElementKey): Project {
  let next = setXforms(p, owner, { [key]: null });
  if (key.startsWith('text:')) return mapOwner(next, owner, (o) => ({ ...o, texts: (o.texts ?? []).filter((t) => `text:${t.id}` !== key) }));
  if (key === 'headline' || key === 'sub') return setTextOf(next, owner, key, '');
  if (owner === 'outro' && key === 'button') return { ...next, outro: { ...next.outro, button: '' } };
  next = mapOwner(next, owner, (o) => {
    if (key === 'badge') return { ...o, badge: '' };
    if (key === 'callout') return { ...o, callout: '' };
    if (key === 'counter') return { ...o, counter: null };
    if (key === 'stickers') return { ...o, effect: 'none' };
    return o;
  });
  return next;
}

export function addTextLayer(p: Project, owner: ElementOwner, layer: TextLayer, xf: ElementXform): Project {
  const next = mapOwner(p, owner, (o) => ({ ...o, texts: [...(o.texts ?? []), layer] }));
  return setXforms(next, owner, { [`text:${layer.id}`]: xf });
}

/** Rewrites every listed element's z to its index — used to move one
 * element forward/backward in the stacking order. */
export function setStackOrder(p: Project, owner: ElementOwner, keysBottomToTop: ElementKey[]): Project {
  return setXforms(p, owner, Object.fromEntries(keysBottomToTop.map((k, i) => [k, { z: i }])));
}
