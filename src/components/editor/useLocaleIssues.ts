'use client';

import { useEffect, useState } from 'react';

import { analyzeLocale, ensureProjectFonts, type LocaleIssue } from '@/engine/export';
import { localizeProject } from '@/engine/localization';
import type { Project } from '@/engine/types';
import '@/components/scriptFontLoader';

/** Text that overflows its layout in `locale` (and not in the source
 * language) — measured once that language's fonts have loaded, since a
 * fallback font's metrics would give the wrong answer. Debounced so
 * typing in the translation table doesn't re-measure every keystroke. */
export function useLocaleIssues(project: Project, locale: string | null): LocaleIssue[] {
  const active = !!locale && !!project.localization && locale !== project.localization.source;
  const [result, setResult] = useState<{ project: Project; locale: string; issues: LocaleIssue[] } | null>(null);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      await ensureProjectFonts(localizeProject(project, project.localization?.source));
      await ensureProjectFonts(localizeProject(project, locale));
      if (!cancelled) setResult({ project, locale: locale!, issues: analyzeLocale(project, locale!) });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [project, locale, active]);
  // Stale results (another language, or before the debounce settles on an
  // edit) keep showing the last measurement for the same language.
  return active && result && result.locale === locale ? result.issues : [];
}
