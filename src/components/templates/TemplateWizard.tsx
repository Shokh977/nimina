'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { getTemplate } from '@/engine/templates';
import type { Slide } from '@/engine/types';
import { assetSrc, loadImageFile, newAssetId } from '@/lib/assetSrc';
import { createClient } from '@/lib/supabase/client';
import { createProjectFromTemplate } from '@/lib/supabase/projects';
import { uploadAsset } from '@/lib/supabase/storage';

/** Modal wizard: shows the template's screenshot "slots", lets the user
 * fill in as many as they want (any left empty are just blank slides the
 * user can fill in later, same as a manually-added slide with no image
 * yet), then creates the project and jumps into the editor. */
export default function TemplateWizard({ templateId, onClose }: { templateId: string; onClose: () => void }) {
  const router = useRouter();
  const template = useMemo(() => getTemplate(templateId), [templateId]);
  const built = useMemo(() => template?.build(), [template]);
  const [files, setFiles] = useState<Record<number, File>>({});
  const [previews, setPreviews] = useState<Record<number, string>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!template || !built) return null;
  const { project, slots } = built;

  const onFile = async (sceneId: number, file: File | undefined) => {
    if (!file) return;
    setFiles((prev) => ({ ...prev, [sceneId]: file }));
    try {
      const { image } = await loadImageFile(file);
      setPreviews((prev) => ({ ...prev, [sceneId]: assetSrc(image) }));
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
      const scenes: Slide[] = project.scenes.map((s) => {
        if (s.kind !== 'image') return s;
        const file = files[s.id];
        if (!file) return s;
        return { ...s, imgAssetId: newAssetId('img') };
      });
      const finalProject = { ...project, scenes };

      const row = await createProjectFromTemplate(supabase, template.name, finalProject);

      await Promise.all(
        scenes.map(async (s) => {
          if (s.kind !== 'image' || !s.imgAssetId) return;
          const file = files[s.id];
          if (!file) return;
          await uploadAsset(supabase, row.id, s.imgAssetId, file);
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
            <p className="mt-0.5 text-[13px] text-neutral-500 dark:text-neutral-400">{template.description}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg border border-black/10 px-2.5 py-1 text-[13px] font-bold dark:border-white/10">
            ✕
          </button>
        </div>

        <p className="mt-4 text-[12.5px] font-bold text-neutral-500 dark:text-neutral-400">
          {filledCount} of {slots.length} screenshots added
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {slots.map((slot) => (
            <label key={slot.sceneId} className="block cursor-pointer">
              <div className="grid aspect-[9/16] place-items-center overflow-hidden rounded-xl border border-dashed border-black/15 bg-neutral-50 dark:border-white/15 dark:bg-neutral-800">
                {previews[slot.sceneId] ? (
                  // eslint-disable-next-line @next/next/no-img-element -- in-memory/data-URL preview
                  <img src={previews[slot.sceneId]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-[11px] text-neutral-400">{slot.label}</span>
                )}
              </div>
              <span className="mt-1 block truncate text-center text-[11px] text-neutral-500 dark:text-neutral-400">{slot.hint}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(slot.sceneId, e.target.files?.[0])} />
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
