import type { Metadata } from 'next';
import TemplatesShell from '@/components/templates/TemplatesShell';
import { listEnabledTemplates } from '@/lib/supabase/templates';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Templates',
  description: 'Promo video templates for fitness, finance, food delivery, social, e-commerce, productivity and SaaS apps — drop in your screenshots and export.',
  alternates: { canonical: '/templates' },
};

export default async function TemplatesPage() {
  const supabase = await createClient();
  // Public: signed-out visitors browse the gallery; choosing a template
  // prompts sign-up (TemplatesShell).
  const [
    {
      data: { user },
    },
    templates,
  ] = await Promise.all([supabase.auth.getUser(), listEnabledTemplates(supabase)]);

  return (
    <TemplatesShell
      userEmail={user ? (user.email ?? '') : null}
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        swatch: t.swatch,
        durationSeconds: t.durationSeconds,
        slotCount: t.build().slots.length,
        previewVideo9x16: t.previewVideo9x16,
      }))}
    />
  );
}
