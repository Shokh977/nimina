'use client';

/** A dropdown over the real, live `templates` table rows — used for the
 * Hero section's "which template plays inside the phone mockup" field.
 * Empty selection stores `null`, which src/components/home/Hero.tsx
 * treats as "pick any template that has a rendered preview". */
export default function TemplateSelect({ templates, value, onChange }: { templates: { id: string; name: string }[]; value: string | null; onChange: (value: string | null) => void }) {
  return (
    <div>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-white/10 dark:bg-neutral-900"
      >
        <option value="">Auto (first template with a preview)</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <p className="mt-1 text-[11.5px] text-neutral-500 dark:text-neutral-400">Only shows up if that template has a rendered preview video — regenerate one from its editor page (/admin/templates) if it doesn&apos;t yet.</p>
    </div>
  );
}
