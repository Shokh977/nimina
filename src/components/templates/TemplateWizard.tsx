'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { Slide } from '@/engine/types';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { createClient } from '@/lib/supabase/client';
import { createProjectFromTemplate } from '@/lib/supabase/projects';
import { uploadAsset } from '@/lib/storage/assets';
import { checkUpload } from '@/lib/storage/rules';
import { getTemplateForWizard, type TemplateWithPreview } from '@/lib/supabase/templates';

/** Modal wizard: shows the template's screenshot "slots", lets the user
 * fill in as many as they want (any left empty are just blank slides/
 * placeholder story screens the user can fill in later, same as a
 * manually-added slide with no image yet), then creates the project and
 * jumps into the editor.
 *
 * A slot's upload can fan out to more than one place in the project — see
 * TemplateSlot.targets in engine/templates/types.ts — e.g. a screenshot
 * shown mid-story via `showScreen` and then again as its own close-up
 * slide is one slot, uploaded once, applied to both. */
export default function TemplateWizard({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateWithPreview | null | undefined>(undefined);
  const [files, setFiles] = useState<Record<string, File>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getTemplateForWizard(createClient(), templateId).then((t) => {
      if (!cancelled) setTemplate(t);
    });
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  if (template === undefined) {
    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="rounded-2xl bg-white p-5 text-[13.5px] font-semibold dark:bg-neutral-900">
          Loading…
        </div>
      </div>
    );
  }
  if (template === null) return null;
  const built = template.build();
  const { project, slots } = built;

  const onFile = async (slotKey: string, file: File | undefined) => {
    if (!file) return;
    const problem = checkUpload('image', file.type, file.size);
    if (problem) return setError(problem);
    setError('');
    setFiles((prev) => ({ ...prev, [slotKey]: file }));
    try {
      const { image } = await loadImageFile(file);
      setPreviews((prev) => ({ ...prev, [slotKey]: assetSrc(image) }));
    } catch {
      // preview is best-effort; the file still gets used on create
    }
  };

  const filledCount = Object.keys(files).length;

  const handleCreate = async () => {
    setCreating(true);
    setError('');
    try {
      const supabase = createClient();

      // slotKey -> the one newly-generated assetId every target for that
      // slot shares, so an ImageSlide and a StorySlide screen fed by the
      // same slot end up pointing at the same uploaded asset.
      const assetIdForSlot = new Map<string, string>();
      for (const slot of slots) {
        if (files[slot.key]) assetIdForSlot.set(slot.key, newAssetId('img'));
      }
      // Every slotted target, filled or not — a template's own build()
      // points these at its procedural sample-asset keys (so the template
      // has a working preview before anyone uploads anything), but a real
      // *created* project must never keep a dangling reference to a
      // sample-only key that won't exist in its own Storage bucket. Any
      // target NOT re-mapped here (filled -> the new upload, unfilled ->
      // explicit null) is left exactly as-is, same as before.
      const targetAssetId = new Map<string, string | null>(); // `${sceneId}` or `${sceneId}:${screenId}` -> assetId | null
      for (const slot of slots) {
        const assetId = assetIdForSlot.get(slot.key) ?? null;
        for (const target of slot.targets) {
          targetAssetId.set(target.screenId ? `${target.sceneId}:${target.screenId}` : `${target.sceneId}`, assetId);
        }
      }

      const scenes: Slide[] = project.scenes.map((s) => {
        if (s.kind === 'image') {
          if (!targetAssetId.has(`${s.id}`)) return s;
          return { ...s, imgAssetId: targetAssetId.get(`${s.id}`)! };
        }
        if (s.kind === 'story') {
          const screens = s.screens.map((screen) => {
            const key = `${s.id}:${screen.id}`;
            if (!targetAssetId.has(key)) return screen;
            // A story screen has no "empty" visual (unlike a blank
            // ImageSlide) — an unfilled slot keeps its own sample id so
            // the story slide still has *something* to show rather than a
            // broken reference; the sample asset just won't resolve once
            // this becomes a real project without that key uploaded, same
            // degradation as any other missing asset.
            return { ...screen, assetId: targetAssetId.get(key) ?? screen.assetId };
          });
          return { ...s, screens };
        }
        return s;
      });
      const finalProject = { ...project, scenes };

      const row = await createProjectFromTemplate(supabase, template.name, finalProject);

      await Promise.all(
        slots.map(async (slot) => {
          const file = files[slot.key];
          const assetId = assetIdForSlot.get(slot.key);
          if (!file || !assetId) return;
          await uploadAsset(row.id, assetId, file);
        }),
      );

      router.push(`/editor/${row.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { code?: string } | null)?.code;
      if (code === '42501' || /row-level security|policy/i.test(message)) {
        setError('The Free plan includes 1 saved project. Upgrade to Pro to create more.');
      } else {
        setError("Couldn't create the project. Try again.");
        console.error('[templates] create failed', err);
      }
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-white p-5 dark:bg-neutral-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-bold">{template.name}</h2>
            <p className="mt-0.5 text-[13px] text-neutral-600 dark:text-neutral-400">{template.description}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg border border-black/10 px-2.5 py-1 text-[13px] font-bold dark:border-white/10">
            ✕
          </button>
        </div>

        <p className="mt-4 text-[12.5px] font-bold text-neutral-600 dark:text-neutral-400">
          {filledCount} of {slots.length} screenshots added
        </p>
        <p className="mt-0.5 text-[12px] text-neutral-600 dark:text-neutral-400">Skip any you don&apos;t have yet — you can add or change every screenshot in the editor.</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {slots.map((slot) => (
            <label key={slot.key} className="block cursor-pointer">
              <div className="grid aspect-[9/16] place-items-center overflow-hidden rounded-xl border border-dashed border-black/15 bg-neutral-50 dark:border-white/15 dark:bg-neutral-800">
                {previews[slot.key] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- in-memory/data-URL preview
                  <img src={previews[slot.key]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-[11px] text-neutral-600">{slot.label}</span>
                )}
              </div>
              <span className="mt-1 block truncate text-center text-[11px] text-neutral-600 dark:text-neutral-400">{slot.hint}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(slot.key, e.target.files?.[0])} />
            </label>
          ))}
        </div>

        {error && <p className="mt-3 text-[13px] font-semibold text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-black/10 px-3.5 py-2 text-[13.5px] font-semibold dark:border-white/10">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={creating} className="rounded-lg bg-indigo-600 px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-50">
            {creating ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </div>
    </div>
  );
}
