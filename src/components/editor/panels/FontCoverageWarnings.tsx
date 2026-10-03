'use client';

import { customFontsInUse } from '@/engine/customFonts';
import { collectStrings, localizeProject } from '@/engine/localization';
import { localeDef, SCRIPT_FAMILIES } from '@/engine/locales';
import { useEditorStore } from '@/store/editorStore';
import { missingChars, useUserFonts } from '../useUserFonts';

/**
 * Warns when an uploaded typeface the project uses has no glyphs for
 * letters a language needs. Those letters still render — the font stack
 * falls back per glyph to the language's Noto font (Figtree for
 * Latin-script languages) — but they won't be in the chosen typeface.
 */
export default function FontCoverageWarnings() {
  const project = useEditorStore((s) => s.project);
  const { fonts } = useUserFonts();
  const used = customFontsInUse(project)
    .map((ref) => ({ ref, font: fonts.find((f) => f.id === ref.id) }))
    .filter((x) => x.font);
  if (!used.length) return null;

  const locales = project.localization ? [project.localization.source, ...project.localization.languages.map((l) => l.locale)] : [null];
  const rows: Array<{ family: string; language: string; missing: string[]; fallback: string }> = [];
  for (const locale of [...new Set(locales)]) {
    const text = collectStrings(localizeProject(project, locale ?? undefined))
      .map((s) => s.source)
      .join(' ');
    const def = locale ? localeDef(locale) : null;
    for (const { ref, font } of used) {
      const missing = missingChars(font!, text);
      if (missing.length) rows.push({ family: ref.family, language: def ? def.label : 'your text', missing, fallback: (def && SCRIPT_FAMILIES[def.script]) || 'Figtree' });
    }
  }
  if (!rows.length) return null;
  return (
    <div role="status" className="grid gap-2 rounded-xl border border-[#ffd166]/30 bg-[#ffd166]/[.06] p-3 text-[12.5px] leading-snug text-[#f4e3b0]">
      {rows.map((r) => (
        <p key={`${r.family}-${r.language}`}>
          <b>{r.family}</b> has no letters for {r.missing.length} character{r.missing.length === 1 ? '' : 's'} in {r.language} (
          <span className="font-mono">{r.missing.slice(0, 8).join(' ')}</span>
          {r.missing.length > 8 ? ' …' : ''}) — those are drawn in {r.fallback} instead.
        </p>
      ))}
    </div>
  );
}
