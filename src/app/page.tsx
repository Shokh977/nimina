import type { Metadata } from 'next';
import ClosingCta from '@/components/home/ClosingCta';
import Faq from '@/components/home/Faq';
import FeatureBento from '@/components/home/FeatureBento';
import Footer from '@/components/home/Footer';
import Header from '@/components/home/Header';
import Hero from '@/components/home/Hero';
import HowItWorks from '@/components/home/HowItWorks';
import PricingSection from '@/components/home/PricingSection';
import TemplateLibrary from '@/components/home/TemplateLibrary';
import { instrumentSans, spaceGrotesk } from '@/lib/fonts';
import { DEFAULT_SITE_CONTENT, getSiteContent } from '@/lib/siteContent';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { listEnabledTemplates, toMarketingCard, type MarketingTemplateCard } from '@/lib/supabase/templates';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const TITLE = 'Nimina — App promo video maker from your screenshots';
const DESCRIPTION =
  'Turn app screenshots into an animated promo video in your browser: real device frames, AI-written headlines, 21 languages, music on the beat, and App Store and Google Play screenshot sizes. Free to start.';

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: ['app promo video', 'app preview video', 'App Store screenshots', 'Google Play screenshots', 'device mockup', 'app marketing video', 'AI video maker', 'app video translation'],
  alternates: { canonical: '/' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/' },
  twitter: { title: TITLE, description: DESCRIPTION },
};

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
/** Structured data for search engines: what the app is (no ratings or
 * review counts — there aren't any yet) and the FAQ as shown on the page. */
function jsonLd(content: typeof DEFAULT_SITE_CONTENT): string {
  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Nimina',
      url: SITE_URL,
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web browser',
      description: DESCRIPTION,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free plan' },
      featureList: [content.feature_bento.heroTitle, ...content.feature_bento.features.map((f) => f.title)],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: content.faq.items.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    },
  ];
  // "<" escaped so text can never close the script tag.
  return JSON.stringify(data).replace(/</g, '\u003c');
}

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
        <FeatureBento content={siteContent.feature_bento} />
        <HowItWorks content={siteContent.how_it_works} />
        <TemplateLibrary content={siteContent.template_library} templates={templates} />
        <PricingSection content={siteContent.pricing} />
        <Faq content={siteContent.faq} />
        <ClosingCta content={siteContent.closing_cta} />
      </main>
      <Footer content={siteContent.footer} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(siteContent) }} />
    </div>
  );
}
