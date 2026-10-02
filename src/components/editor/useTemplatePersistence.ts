'use client';

import { useEffect, useRef, useState } from 'react';

import { getTimeline } from '@/engine/render';
import { getTemplate } from '@/engine/templates';
import type { Project } from '@/engine/types';
import { createClient } from '@/lib/supabase/client';
import { loadProjectImageAssets } from '@/lib/storage/assets';
import type { TemplateData } from '@/lib/supabase/templates';
import { useEditorStore } from '@/store/editorStore';
import type { SaveStatus } from './usePersistence';

const SAVE_DEBOUNCE_MS = 1500;

/** Sibling to usePersistence.ts, not a branch inside it — that hook's
 * "always saves to projects.data" contract stays simple to read, and this
 * one saves to templates.data + template_versions instead. Loads a
 * template's images from its original code file's buildSampleAssets()
 * (synchronous, no network — see sampleAssetsSourceId's doc comment in
 * src/lib/supabase/templates.ts) so the Stage renders immediately, then
 * best-effort overrides any placeholder with a real upload from a prior
 * editing session. */
export function useTemplatePersistence(templateId: string, initialProject: Project, initialSlots: TemplateData['slots'], initialShortVariant: TemplateData['shortVariant'], sampleAssetsSourceId: string | null): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>('loading');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;
    const supabase = createClient();

    function attachAutosave() {
      let prevProject = useEditorStore.getState().project;
      unsubscribe = useEditorStore.subscribe((state) => {
        if (state.project === prevProject) return;
        prevProject = state.project;
        setStatus('saving');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          void (async () => {
            try {
              const {
                data: { user },
              } = await supabase.auth.getUser();
              const data: TemplateData = { project: state.project, slots: initialSlots, shortVariant: initialShortVariant };
              const { error: updateErr } = await supabase
                .from('templates')
                .update({ data, slot_count: initialSlots.length, duration_seconds: getTimeline(state.project).total, updated_at: new Date().toISOString() })
                .eq('id', templateId);
              if (updateErr) throw updateErr;

              const { data: maxVersionRow } = await supabase.from('template_versions').select('version').eq('template_id', templateId).order('version', { ascending: false }).limit(1).maybeSingle();
              const nextVersion = (maxVersionRow?.version ?? 0) + 1;
              const { error: versionErr } = await supabase.from('template_versions').insert({ template_id: templateId, version: nextVersion, data, created_by: user?.id ?? null });
              if (versionErr) throw versionErr;

              if (!cancelled) setStatus('saved');
            } catch (err) {
              console.error('[template persistence] autosave failed:', err);
              if (!cancelled) setStatus('error');
            }
          })();
        }, SAVE_DEBOUNCE_MS);
      });
    }

    async function hydrate() {
      const sampleAssets = (sampleAssetsSourceId && getTemplate(sampleAssetsSourceId)?.buildSampleAssets?.()) || {};
      useEditorStore.getState().loadProject(initialProject, templateId, { images: sampleAssets });

      // Best-effort: a real upload from a prior editing session overrides
      // the procedural placeholder above. Most ids won't have one yet —
      // that's expected, not an error.
      const realAssets = await loadProjectImageAssets(templateId, initialProject);
      if (!cancelled) {
        for (const [assetId, img] of Object.entries(realAssets)) useEditorStore.getState().registerImage(assetId, img);
      }

      if (!cancelled) {
        setStatus('saved');
        attachAutosave();
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      unsubscribe?.();
    };
    // Only re-run for a different templateId — initialProject/initialSlots/
    // initialShortVariant/sampleAssetsSourceId only seed the first hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  return status;
}
