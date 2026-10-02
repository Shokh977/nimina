'use client';

import { localeDef } from '@/engine/locales';
import { useEditorStore } from '@/store/editorStore';
import { useLocaleIssues } from './useLocaleIssues';

/** Stage overlay: which language the preview renders, with a warning
 * count when the previewed language has text that overflows its layout.
 * Only shown once a project has more than one language. */
export default function LanguageSwitcher() {
  const project = useEditorStore((s) => s.project);
  const previewLocale = useEditorStore((s) => s.previewLocale);
  const setPreviewLocale = useEditorStore((s) => s.setPreviewLocale);
  const loc = project.localization;
  const current = previewLocale && loc?.languages.some((l) => l.locale === previewLocale) ? previewLocale : (loc?.source ?? null);
  const issues = useLocaleIssues(project, current);
  if (!loc || loc.languages.length < 2) return null;

  return (
    <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
      {issues.length > 0 && (
        <span title={issues.map((i) => i.message).join('\n')} className="rounded-[7px] bg-[#ff8f76]/90 px-2 py-[5px] text-[11px] font-semibold text-[#2a0f06]">
          ⚠ {issues.length} overflow{issues.length === 1 ? '' : 's'}
        </span>
      )}
      <select
        aria-label="Preview language"
        value={current ?? ''}
        onChange={(e) => setPreviewLocale(e.target.value === loc.source ? null : e.target.value)}
        className="rounded-[7px] border border-white/15 bg-[#08090c]/70 px-2 py-[5px] text-[11.5px] font-semibold text-[#f4f5f8] backdrop-blur-sm"
      >
        {loc.languages.map((l) => (
          <option key={l.locale} value={l.locale}>
            {localeDef(l.locale).native}
            {l.locale === loc.source ? ' (source)' : ''}
          </option>
        ))}
      </select>
    </div>
  );
}
