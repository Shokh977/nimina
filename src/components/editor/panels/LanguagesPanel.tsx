'use client';

import FontCoverageWarnings from './FontCoverageWarnings';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { checkHighlights, collectStrings, fieldLabel, stringStatus, type LocalizableString, type StringStatus } from '@/engine/localization';
import { LOCALES, localeDef, SCRIPT_FAMILIES } from '@/engine/locales';
import { isPro, PLAN_LIMITS } from '@/lib/plan';
import { useEditorStore } from '@/store/editorStore';
import { useLocaleIssues } from '../useLocaleIssues';
import RangeInput from '../ui/RangeInput';
import SectionLabel from '../ui/SectionLabel';
import SegmentedControl from '../ui/SegmentedControl';

const SELECT_CLASS =
  'block h-10 w-full rounded-[10px] border border-white/[.12] bg-[#0d0f15] px-3 text-[13.5px] text-[#f4f5f8] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]';

const STATUS_STYLE: Record<StringStatus, { label: string; cls: string }> = {
  translated: { label: 'Done', cls: 'bg-[#1f6f4a]/40 text-[#8de0b5]' },
  untranslated: { label: 'Untranslated', cls: 'bg-[#8a6a14]/40 text-[#f2cf6b]' },
  outdated: { label: 'Source changed', cls: 'bg-[#8a3a14]/40 text-[#ffab85]' },
};

/** Flags a string whose *highlight* markers won't render where they read
 * (localization.ts checkHighlights) and offers the corrected placement. */
function HighlightWarning({ text, onFix }: { text: string; onFix: (fixed: string) => void }) {
  const check = checkHighlights(text);
  if (check.ok) return null;
  return (
    <span className="mt-1 flex items-start gap-2 rounded-[7px] bg-[#ffb02e]/[.12] px-2 py-1 text-[11.5px] text-[#ffd07a]">
      <span className="min-w-0 flex-1">⚠ {check.reason}</span>
      <button type="button" tabIndex={-1} onClick={() => onFix(check.fixed)} className="shrink-0 font-semibold text-[#ffe2a8] underline">
        Fix
      </button>
    </span>
  );
}

interface Proposal {
  key: string;
  current: string;
  proposed: string;
  accept: boolean;
}

/** Font stack for a language's text in the table (the script font, once
 * loaded, gives the same glyphs the canvas draws). */
const textFont = (code: string) => {
  const family = SCRIPT_FAMILIES[localeDef(code).script];
  return family ? `"${family}", var(--font-instrument-sans), system-ui, sans-serif` : undefined;
};

/**
 * Languages: the project's source language, the languages it ships in,
 * and a side-by-side translation table per language — source on the left,
 * the translation on the right, grouped by slide, Tab moving field to
 * field. Strings start as a copy of the source ("Untranslated") and become
 * "Done" once edited or confirmed; a later change to the source marks them
 * "Source changed". "Translate all" asks Claude for every string, then
 * shows each proposed change for review — nothing is applied until the
 * user accepts it.
 */
export default function LanguagesPanel() {
  const project = useEditorStore((s) => s.project);
  const plan = useEditorStore((s) => s.plan);
  const previewLocale = useEditorStore((s) => s.previewLocale);
  const setPreviewLocale = useEditorStore((s) => s.setPreviewLocale);
  const enableLocalization = useEditorStore((s) => s.enableLocalization);
  const setSourceLocale = useEditorStore((s) => s.setSourceLocale);
  const addLanguage = useEditorStore((s) => s.addLanguage);
  const removeLanguage = useEditorStore((s) => s.removeLanguage);
  const setTranslation = useEditorStore((s) => s.setTranslation);
  const setTranslationDone = useEditorStore((s) => s.setTranslationDone);
  const applyTranslations = useEditorStore((s) => s.applyTranslations);
  const setLanguageFontScale = useEditorStore((s) => s.setLanguageFontScale);

  const loc = project.localization;
  const source = loc?.source ?? 'en';
  const targets = (loc?.languages ?? []).filter((l) => l.locale !== source);
  const [picked, setPicked] = useState<string | null>(null);
  const active = targets.find((t) => t.locale === (picked ?? previewLocale)) ?? targets[0] ?? null;
  const [filter, setFilter] = useState<'all' | 'todo'>('all');
  const [notice, setNotice] = useState('');
  const [aiState, setAiState] = useState<{ loading: boolean; error: string; proposals: Proposal[] | null; locale: string | null }>({ loading: false, error: '', proposals: null, locale: null });

  const strings = useMemo(() => collectStrings(project), [project]);
  const issues = useLocaleIssues(project, active?.locale ?? null);
  const maxLanguages = PLAN_LIMITS[plan].maxLanguages;
  const canAdd = Math.max(1, loc?.languages.length ?? 1) < maxLanguages;

  const groupTitle = (group: string) => {
    if (group === 'app') return 'App name & intro';
    if (group === 'outro') return 'Closing card';
    const id = Number(group.slice('slide:'.length));
    return `Slide ${project.scenes.findIndex((s) => s.id === id) + 1}`;
  };
  const issueFor = (group: string) =>
    issues.filter((i) => (group === 'app' ? i.where === 'intro' : group === 'outro' ? i.where === 'outro' : `slide:${i.where}` === group));

  const select = (code: string) => {
    setPicked(code);
    setPreviewLocale(code);
  };

  const onAdd = (code: string) => {
    if (!code) return;
    if (!loc) enableLocalization(source);
    if (!addLanguage(code)) {
      setNotice(`The free plan includes one language per project. Upgrade to Pro to add ${localeDef(code).label}.`);
      return;
    }
    setNotice('');
    select(code);
  };

  const translateAll = async () => {
    if (!active) return;
    setAiState({ loading: true, error: '', proposals: null, locale: active.locale });
    try {
      const res = await fetch('/api/ai/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceLocale: source, targetLocale: active.locale, appName: project.appName, strings: strings.map(({ key, field, group, source: text }) => ({ key, field, group, source: text })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Translation failed.');
      const proposals: Proposal[] = strings
        .filter((s) => typeof data.translations[s.key] === 'string')
        .map((s) => {
          const current = active.strings[s.key]?.text ?? s.source;
          return { key: s.key, current, proposed: data.translations[s.key], accept: true };
        })
        .filter((p) => p.proposed !== p.current || !active.strings[p.key]?.done);
      setAiState({ loading: false, error: '', proposals, locale: active.locale });
    } catch (err) {
      setAiState({ loading: false, error: err instanceof Error ? err.message : 'Translation failed.', proposals: null, locale: active.locale });
    }
  };

  const applyProposals = () => {
    if (!aiState.proposals || !aiState.locale) return;
    applyTranslations(aiState.locale, Object.fromEntries(aiState.proposals.filter((p) => p.accept).map((p) => [p.key, p.proposed])));
    setAiState({ loading: false, error: '', proposals: null, locale: null });
  };

  const existing = new Set((loc?.languages ?? []).map((l) => l.locale));
  const counts = (code: string) => {
    const l = targets.find((t) => t.locale === code);
    const done = strings.filter((s) => stringStatus(l?.strings[s.key], s.source) === 'translated').length;
    return `${done}/${strings.length}`;
  };

  const groups = new Map<string, LocalizableString[]>();
  for (const s of strings) groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  const reviewing = aiState.proposals && aiState.locale === active?.locale ? aiState.proposals : null;

  return (
    <div className="grid grid-cols-1 gap-5">
      <FontCoverageWarnings />
      <div>
        <SectionLabel>Source language</SectionLabel>
        <select
          className={SELECT_CLASS}
          value={source}
          disabled={targets.length > 0}
          onChange={(e) => (loc ? setSourceLocale(e.target.value) : enableLocalization(e.target.value))}
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label} — {l.native}
            </option>
          ))}
        </select>
        <p className="mt-2 text-[12px] text-[#767e8d]">The language the project&apos;s own text is written in{targets.length > 0 ? ' (remove other languages to change it)' : ''}.</p>
      </div>

      <div>
        <SectionLabel trailing={!isPro(plan) && <span className="text-[11.5px] text-[#767e8d]">Free: 1 language</span>}>Languages</SectionLabel>
        <div className="grid gap-1.5">
          {targets.map((t) => {
            const on = t.locale === active?.locale;
            return (
              <div key={t.locale} className={`flex items-center gap-2 rounded-[11px] border px-3 py-2 ${on ? 'border-[#8b7dff]/60 bg-[#5b4bff]/[.12]' : 'border-white/10 bg-white/[.03]'}`}>
                <button type="button" onClick={() => select(t.locale)} className="min-w-0 flex-1 truncate text-left text-[13px] font-semibold text-[#f4f5f8]">
                  {localeDef(t.locale).label} <span className="font-normal text-[#9aa1af]">{localeDef(t.locale).native}</span>
                </button>
                <span className="shrink-0 font-[family-name:var(--font-space-grotesk)] text-[11.5px] text-[#767e8d]">{counts(t.locale)}</span>
                <button type="button" aria-label={`Remove ${localeDef(t.locale).label}`} onClick={() => removeLanguage(t.locale)} className="shrink-0 rounded px-1.5 text-[14px] text-[#767e8d] hover:text-[#ff8f76]">
                  ×
                </button>
              </div>
            );
          })}
          <select className={SELECT_CLASS} value="" onChange={(e) => onAdd(e.target.value)} aria-label="Add a language">
            <option value="">{canAdd ? '+ Add a language…' : '+ Add a language (Pro) 🔒'}</option>
            {LOCALES.filter((l) => !existing.has(l.code) && l.code !== source).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label} — {l.native}
              </option>
            ))}
          </select>
        </div>
        {notice && (
          <p className="mt-2 text-[12px] text-[#cfc8ff]">
            {notice}{' '}
            <Link href="/pricing" className="font-semibold text-[#8b7dff] hover:text-[#a89bff]">
              Upgrade
            </Link>
          </p>
        )}
      </div>

      {active && (
        <>
          <div className="rounded-xl border border-white/[.08] bg-white/[.02] p-3.5">
            <RangeInput
              label={`${localeDef(active.locale).label} text size`}
              valueLabel={`${Math.round(active.fontScale * 100)}%`}
              min={0.6}
              max={1.1}
              step={0.01}
              value={active.fontScale}
              onChange={(v) => setLanguageFontScale(active.locale, v)}
            />
            <p className="mt-2 text-[12px] text-[#767e8d]">Shrinks every headline and subtitle in this language only — for languages that run long.</p>
            {issues.length > 0 ? (
              <ul className="mt-3 grid gap-1 rounded-lg border border-[#ff8f76]/30 bg-[#ff8f76]/[.06] px-3 py-2">
                {issues.map((i, n) => (
                  <li key={n} className="text-[12px] text-[#f0c9c0]">
                    ⚠ {i.where === 'intro' ? 'Intro' : i.where === 'outro' ? 'Closing card' : `Slide ${project.scenes.findIndex((s) => s.id === i.where) + 1}`}: {i.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[12px] text-[#8de0b5]">✓ All text fits in {localeDef(active.locale).label}.</p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={translateAll}
              disabled={aiState.loading || PLAN_LIMITS[plan].maxTranslateUsesPerMonth === 0}
              className="w-full rounded-xl bg-[#5b4bff] px-4 py-2.5 text-[14px] font-semibold text-white transition-colors duration-[.16s] hover:bg-[#6d5eff] disabled:opacity-50"
            >
              {aiState.loading ? 'Translating…' : `Translate all into ${localeDef(active.locale).label} with AI${isPro(plan) ? '' : ' 🔒'}`}
            </button>
            <p className="mt-2 text-[12px] text-[#767e8d]">Every change is shown for review first; nothing is applied until you accept it.</p>
            {aiState.error && aiState.locale === active.locale && <p className="mt-2 text-[12.5px] text-[#ff8f76]">{aiState.error}</p>}
          </div>

          {reviewing && (
            <div className="rounded-xl border border-[#8b7dff]/[.35] bg-[#5b4bff]/[.06] p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-[#f4f5f8]">Review {reviewing.length} suggested changes</span>
                <button type="button" onClick={() => setAiState((s) => ({ ...s, proposals: s.proposals!.map((p) => ({ ...p, accept: !s.proposals!.every((q) => q.accept) })) }))} className="text-[12px] font-semibold text-[#8b7dff]">
                  Toggle all
                </button>
              </div>
              <ul className="grid max-h-[340px] gap-2 overflow-y-auto">
                {reviewing.map((p, n) => {
                  const s = strings.find((x) => x.key === p.key);
                  return (
                    <li key={p.key}>
                      <label className="flex min-h-11 gap-2.5 text-[12.5px] md:min-h-0">
                        <input type="checkbox" checked={p.accept} onChange={() => setAiState((st) => ({ ...st, proposals: st.proposals!.map((q, k) => (k === n ? { ...q, accept: !q.accept } : q)) }))} className="mt-1" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] text-[#767e8d]">
                            {s ? `${groupTitle(s.group)} · ${fieldLabel(s.field)}` : p.key}
                          </span>
                          <span className="block text-[#9aa1af] line-through" dir={localeDef(active.locale).dir} style={{ fontFamily: textFont(active.locale) }}>
                            {p.current}
                          </span>
                          <span className="block text-[#f4f5f8]" dir={localeDef(active.locale).dir} lang={active.locale} style={{ fontFamily: textFont(active.locale) }}>
                            {p.proposed}
                          </span>
                        </span>
                      </label>
                      <HighlightWarning text={p.proposed} onFix={(fixed) => setAiState((st) => ({ ...st, proposals: st.proposals!.map((q, k) => (k === n ? { ...q, proposed: fixed } : q)) }))} />
                    </li>
                  );
                })}
              </ul>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={applyProposals} className="flex-1 rounded-[10px] bg-[#5b4bff] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#6d5eff]">
                  Apply {reviewing.filter((p) => p.accept).length} selected
                </button>
                <button type="button" onClick={() => setAiState({ loading: false, error: '', proposals: null, locale: null })} className="rounded-[10px] border border-white/[.16] px-3 py-2 text-[13px] font-semibold text-[#f4f5f8]">
                  Discard
                </button>
              </div>
            </div>
          )}

          <div>
            <SectionLabel
              trailing={
                <SegmentedControl
                  options={[
                    ['all', 'All'],
                    ['todo', 'Needs work'],
                  ]}
                  value={filter}
                  onChange={setFilter}
                />
              }
            >
              Translations
            </SectionLabel>
            <div className="grid gap-4">
              {[...groups.entries()].map(([group, items]) => {
                const rows = items.filter((s) => filter === 'all' || stringStatus(active.strings[s.key], s.source) !== 'translated');
                if (!rows.length) return null;
                const groupIssues = issueFor(group);
                return (
                  <section key={group}>
                    <h3 className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold tracking-wide text-[#9aa1af] uppercase">
                      {groupTitle(group)}
                      {groupIssues.length > 0 && <span className="normal-case text-[#ff8f76]">⚠ {groupIssues[0].message}</span>}
                    </h3>
                    <div className="grid gap-2">
                      {rows.map((s) => {
                        const entry = active.strings[s.key];
                        const status = stringStatus(entry, s.source);
                        const value = entry?.text ?? s.source;
                        return (
                          <div key={s.key} className="grid grid-cols-1 gap-2 rounded-[10px] md:grid-cols-2 border border-white/[.07] bg-white/[.02] p-2">
                            <div className="col-span-full flex items-center justify-between">
                              <span className="text-[11.5px] text-[#767e8d]">{fieldLabel(s.field)}</span>
                              <button
                                type="button"
                                tabIndex={-1}
                                onClick={() => setTranslationDone(active.locale, s.key, status !== 'translated')}
                                title={status === 'translated' ? 'Mark as needing work' : 'Mark as done'}
                                className={`rounded-full px-2 py-[2px] text-[10.5px] font-semibold ${STATUS_STYLE[status].cls}`}
                              >
                                {STATUS_STYLE[status].label}
                              </button>
                            </div>
                            <p className="text-[12.5px] leading-snug break-words text-[#9aa1af]" dir={localeDef(source).dir} lang={source} style={{ fontFamily: textFont(source) }}>
                              {s.source}
                            </p>
                            <textarea
                              aria-label={`${groupTitle(group)} ${fieldLabel(s.field)} in ${localeDef(active.locale).label}`}
                              value={value}
                              dir={localeDef(active.locale).dir}
                              lang={active.locale}
                              rows={Math.min(4, Math.max(1, Math.ceil(value.length / 22)))}
                              onChange={(e) => setTranslation(active.locale, s.key, e.target.value)}
                              style={{ fontFamily: textFont(active.locale) }}
                              className="w-full resize-none rounded-[8px] border border-white/[.12] bg-black/20 px-2 py-1 text-[12.5px] leading-snug text-[#f4f5f8] outline-none focus-visible:border-[#8b7dff]"
                            />
                            <div className="col-span-full empty:hidden">
                              <HighlightWarning text={value} onFix={(fixed) => setTranslation(active.locale, s.key, fixed)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
              {strings.length === 0 && <p className="text-[12.5px] text-[#767e8d]">This project has no text to translate yet.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
