import type { Metadata } from 'next';
import ClosingCta from '@/components/home/ClosingCta';
import Faq from '@/components/home/Faq';
import FeatureBento from '@/components/home/FeatureBento';
import Footer from '@/components/home/Footer';
import Header from '@/components/home/Header';
import Hero from '@/components/home/Hero';
import HowItWorks from '@/components/home/HowItWorks';
import LogoMarquee from '@/components/home/LogoMarquee';
import PricingSection from '@/components/home/PricingSection';
import StatsBand from '@/components/home/StatsBand';
import TemplateLibrary from '@/components/home/TemplateLibrary';
import Testimonials from '@/components/home/Testimonials';
import { instrumentSans, spaceGrotesk } from '@/lib/fonts';
import { DEFAULT_SITE_CONTENT, getSiteContent } from '@/lib/siteContent';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { listEnabledTemplates, toMarketingCard, type MarketingTemplateCard } from '@/lib/supabase/templates';

export const metadata: Metadata = { alternates: { canonical: '/' } };

/**
 * The marketing homepage — fully self-contained (own header/footer, own
 * dark theme, own type system), so it lives at the true app root rather
 * than in (marketing)/, which still serves /pricing, /privacy, /terms,
 * /refunds with the shared Nav/Footer + light/dark-toggle theme.
 *
 * Every section's copy comes from `site_content` (src/lib/siteContent.ts,
 * admin-editable at /admin/homepage) and the template library pulls real
 * rows from the `templates` table (src/lib/supabase/templates.ts) — the
 * same data /admin/templates and /templates already manage/show. Both fall
 * back gracefully (defaults / empty list) when Supabase isn't configured.
 */
export default async function HomePage() {
  let signedIn = false;
  let templates: MarketingTemplateCard[] = [];
  let siteContent = DEFAULT_SITE_CONTENT;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
    const [content, templateRows] = await Promise.all([getSiteContent(supabase), listEnabledTemplates(supabase)]);
    siteContent = content;
    templates = templateRows.map(toMarketingCard);
  }

  const templatesWithPreview = templates.filter((t) => t.previewVideo9x16);
  const featuredTemplate = templatesWithPreview.find((t) => t.id === siteContent.hero.featuredTemplateId) ?? templatesWithPreview[0] ?? null;

  return (
    <div className={`${spaceGrotesk.variable} ${instrumentSans.variable} flex-1 bg-[#08090c] text-[#f4f5f8]`} style={{ fontFamily: 'var(--font-instrument-sans), "Instrument Sans", system-ui, sans-serif' }}>
      <Header signedIn={signedIn} />
      <main>
        <Hero content={siteContent.hero} featuredTemplate={featuredTemplate} />
        <LogoMarquee content={siteContent.logos} />
        <TemplateLibrary content={siteContent.template_library} templates={templates} />
        <HowItWorks content={siteContent.how_it_works} />
        <FeatureBento content={siteContent.feature_bento} />
        <StatsBand content={siteContent.stats} />
        <Testimonials content={siteContent.testimonials} />
        <PricingSection content={siteContent.pricing} />
        <Faq content={siteContent.faq} />
        <ClosingCta content={siteContent.closing_cta} />
      </main>
      <Footer content={siteContent.footer} />
    </div>
  );
}
