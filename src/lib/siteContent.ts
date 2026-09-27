import type { SupabaseClient } from '@supabase/supabase-js';

/** Admin-editable marketing content for the homepage
 * (src/app/page.tsx + src/components/home/*). One row per section in the
 * `site_content` table (key + jsonb `data`), managed at /admin/homepage.
 * Every field here defaults to today's real copy (DEFAULT_SITE_CONTENT
 * below, and supabase/migrations/0014_site_content.sql's seed data are the
 * same values, kept in sync by hand) — a missing row, a missing field, or
 * Supabase not being configured all fall back to these, so the homepage
 * never renders empty. */

export interface HeroContent {
  badgeLabel: string;
  badgeText: string;
  headingLine1: string;
  headingHighlight: string;
  headingRest: string;
  subhead: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  avatarCaption: string;
  exportBadgeText: string;
  /** Which real template (templates.id) plays inside the phone mockup —
   * picked in /admin/homepage's Hero tab from a live list of published
   * templates. `null` (or a stale/unpublished id) falls back to the first
   * template that has a rendered preview (see src/components/home/Hero.tsx). */
  featuredTemplateId: string | null;
}

export interface LogoItem {
  name: string;
}

export interface LogosContent {
  label: string;
  items: LogoItem[];
}

export interface TemplateLibraryContent {
  eyebrow: string;
  heading: string;
  subhead: string;
  footerLinkHref: string;
}

export interface HowItWorksStep {
  number: string;
  title: string;
  body: string;
}

export interface HowItWorksContent {
  eyebrow: string;
  heading: string;
  steps: HowItWorksStep[];
}

export interface FeatureBentoItem {
  title: string;
  body: string;
}

export interface FeatureBentoContent {
  heading: string;
  subhead: string;
  heroTitle: string;
  heroBody: string;
  features: FeatureBentoItem[];
}

export interface StatItem {
  value: string;
  label: string;
}

export interface StatsContent {
  items: StatItem[];
}

export interface TestimonialItem {
  quote: string;
  initials: string;
  name: string;
  role: string;
  avatar: string;
  dark: boolean;
}

export interface TestimonialsContent {
  heading: string;
  items: TestimonialItem[];
}

export interface PricingPlanContent {
  name: string;
  price: string;
  suffix: string;
  features: string[];
  ctaLabel: string;
}

export interface PricingContent {
  heading: string;
  subhead: string;
  plans: PricingPlanContent[];
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqContent {
  heading: string;
  items: FaqItem[];
}

export interface ClosingCtaContent {
  heading: string;
  subhead: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
}

export interface FooterLink {
  href: string;
  label: string;
}

export interface FooterContent {
  copyrightText: string;
  links: FooterLink[];
}

export interface SiteContent {
  hero: HeroContent;
  logos: LogosContent;
  template_library: TemplateLibraryContent;
  how_it_works: HowItWorksContent;
  feature_bento: FeatureBentoContent;
  stats: StatsContent;
  testimonials: TestimonialsContent;
  pricing: PricingContent;
  faq: FaqContent;
  closing_cta: ClosingCtaContent;
  footer: FooterContent;
}

export type SiteContentKey = keyof SiteContent;

export const SITE_CONTENT_KEYS: SiteContentKey[] = ['hero', 'logos', 'template_library', 'how_it_works', 'feature_bento', 'stats', 'testimonials', 'pricing', 'faq', 'closing_cta', 'footer'];

/** Today's real copy — the fallback for any section/field not (yet) in the
 * database, and what supabase/migrations/0014_site_content.sql seeds. */
export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero: {
    badgeLabel: 'New',
    badgeText: '42 ready-made promo templates',
    headingLine1: 'Screenshots in.',
    headingHighlight: 'Scroll-stopping',
    headingRest: 'promo out.',
    subhead: 'Drop in a few app screenshots, pick a premade edit, and Nimina frames them in real devices, animates the copy, and exports a polished MP4. No timeline, no design skills.',
    ctaPrimaryLabel: 'Start free',
    ctaPrimaryHref: '/login',
    ctaSecondaryLabel: 'Browse templates',
    ctaSecondaryHref: '#templates',
    avatarCaption: '12,400+ founders and marketers shipping promos weekly',
    exportBadgeText: 'MP4 exported in 38s',
    featuredTemplateId: null,
  },
  logos: {
    label: 'Promos shipped by teams at',
    items: [{ name: 'Northgate' }, { name: 'Bloomlet' }, { name: 'Kasetta' }, { name: 'Orbitly' }, { name: 'Finwell' }, { name: 'Tidewave' }, { name: 'Paperplane' }],
  },
  template_library: {
    eyebrow: 'Template library',
    heading: 'Start from an edit that already works',
    subhead: "Every template is a full edit — pacing, device frames, captions and music beds. Swap your screenshots in and it's done.",
    footerLinkHref: '/login',
  },
  how_it_works: {
    eyebrow: 'Three steps',
    heading: 'From screenshot folder to finished cut',
    steps: [
      { number: '01', title: 'Drop your screenshots', body: 'Drag in up to 20 PNGs. We detect the device size and crop each one to fit its frame.' },
      { number: '02', title: 'Pick a premade edit', body: 'Choose a template, then tweak colors, fonts and captions — per slide or across the whole video.' },
      { number: '03', title: 'Export and post', body: 'Render up to 4K MP4 with 9:16, 1:1 and 16:9 variants of the same cut, ready for every channel.' },
    ],
  },
  feature_bento: {
    heading: 'Everything a promo video needs',
    subhead: 'The parts an agency would charge you for, built in.',
    heroTitle: 'Real device frames, six finishes',
    heroBody: 'Island and notch phones, Android, tablet and browser mockups — pick the frame that matches your product, in titanium, graphite, or clear.',
    features: [
      { title: 'Motion that sells it', body: 'Beat-matched pans, parallax and text reveals — timed for you, adjustable when you want control.' },
      { title: 'Brand kit, applied once', body: 'Save logo, colors and type. Every new project opens already looking like you.' },
      { title: 'Captions and voiceover', body: 'Auto-styled subtitles plus an optional AI read of your script, in eight voices.' },
      { title: 'Fast MP4 export', body: 'Renders in the cloud in under a minute, up to 4K and 60fps, with no watermark on Pro.' },
    ],
  },
  stats: {
    items: [
      { value: '42', label: 'premade edits' },
      { value: '3 min', label: 'average time to first cut' },
      { value: '190k', label: 'videos rendered' },
      { value: '4K', label: 'export, 60fps' },
    ],
  },
  testimonials: {
    heading: "Loved by people who don't edit video",
    items: [
      { quote: 'I made our App Store teaser on a Tuesday night and it outperformed the agency cut we paid four figures for.', initials: 'MR', name: 'Maya Rautio', role: 'Founder, Kasetta', avatar: 'linear-gradient(140deg,#5b4bff,#8b7dff)', dark: false },
      { quote: 'We ship a feature promo with every release now. The template library means nobody has to open After Effects.', initials: 'DO', name: 'Dele Okafor', role: 'Head of Growth, Orbitly', avatar: 'linear-gradient(140deg,#ff7a59,#ffb08f)', dark: false },
      { quote: 'Nine vertical variants for a paid test in one afternoon. That used to be a whole sprint of back-and-forth.', initials: 'SL', name: 'Sara Lindqvist', role: 'Performance lead, Finwell', avatar: 'linear-gradient(140deg,#5ee6b5,#a8f5d8)', dark: true },
    ],
  },
  pricing: {
    heading: 'Simple pricing',
    subhead: 'Start free. Upgrade when you need the watermark gone.',
    plans: [
      { name: 'Free', price: '$0', suffix: 'forever', features: ['1 project', '720p export, watermarked', '8 starter templates', 'Device frames'], ctaLabel: 'Start free' },
      { name: 'Pro', price: '$19', suffix: '/ month', features: ['Unlimited projects', 'Up to 4K, no watermark', 'All 42 templates', 'Brand kit + captions', 'All aspect-ratio variants'], ctaLabel: 'Go Pro' },
    ],
  },
  faq: {
    heading: 'Frequently asked questions',
    items: [
      { q: 'Do I need design or video-editing skills?', a: 'No. Every template is a finished edit — pacing, framing and motion are already set. You add screenshots and swap the copy.' },
      { q: 'What formats can I export?', a: 'MP4 up to 4K at 60fps, in 9:16, 1:1 and 16:9. Pro renders the same cut in every ratio at once.' },
      { q: 'Can I use my own brand colors and fonts?', a: 'Yes. Save a brand kit once — logo, palette, type — and every new project opens with it applied.' },
      { q: "What's the difference between Free and Pro?", a: 'Free gives you one project at 720p with a watermark and eight templates. Pro unlocks unlimited projects, all 42 templates, 4K and no watermark.' },
      { q: 'Can I cancel anytime?', a: 'Yes, from your account page. Your exported videos stay yours, and projects remain viewable on the free plan.' },
      { q: 'Are my screenshots and projects private?', a: 'Always. Uploads are private to your workspace, never used for training, and deletable at any time.' },
    ],
  },
  closing_cta: {
    heading: 'Your next promo is 3 minutes away',
    subhead: 'Pick a template, drop your screenshots, hit export. Free plan, no credit card.',
    ctaPrimaryLabel: 'Start free',
    ctaPrimaryHref: '/login',
    ctaSecondaryLabel: 'Browse templates',
    ctaSecondaryHref: '#templates',
  },
  footer: {
    copyrightText: '© 2026 Nimina. All rights reserved.',
    links: [
      { href: '#templates', label: 'Templates' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
      { href: '/refunds', label: 'Refunds' },
    ],
  },
};

/** Fetches every site_content row and merges each section over its
 * default (missing row, missing Supabase config, or a query error all fall
 * back to DEFAULT_SITE_CONTENT — the homepage never renders empty). Pass
 * `null` when Supabase isn't configured to skip the query entirely. */
export async function getSiteContent(supabase: SupabaseClient | null): Promise<SiteContent> {
  if (!supabase) return DEFAULT_SITE_CONTENT;

  const { data, error } = await supabase.from('site_content').select('key, data');
  if (error || !data) return DEFAULT_SITE_CONTENT;

  const result: Record<string, unknown> = { ...DEFAULT_SITE_CONTENT };
  for (const row of data) {
    if (SITE_CONTENT_KEYS.includes(row.key as SiteContentKey)) {
      result[row.key] = { ...(result[row.key] as object), ...(row.data as object) };
    }
  }
  return result as unknown as SiteContent;
}
