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
  exportBadgeText: string;
  /** Which real template (templates.id) plays inside the phone mockup —
   * picked in /admin/homepage's Hero tab from a live list of published
   * templates. `null` (or a stale/unpublished id) falls back to the first
   * template that has a rendered preview (see src/components/home/Hero.tsx). */
  featuredTemplateId: string | null;
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
  template_library: TemplateLibraryContent;
  how_it_works: HowItWorksContent;
  feature_bento: FeatureBentoContent;
  pricing: PricingContent;
  faq: FaqContent;
  closing_cta: ClosingCtaContent;
  footer: FooterContent;
}

export type SiteContentKey = keyof SiteContent;

export const SITE_CONTENT_KEYS: SiteContentKey[] = ['hero', 'template_library', 'how_it_works', 'feature_bento', 'pricing', 'faq', 'closing_cta', 'footer'];

/** The homepage copy — the fallback for any section/field not (yet) in the
 * database, and what supabase/migrations/0014_site_content.sql seeds. */
export const DEFAULT_SITE_CONTENT: SiteContent = {
  hero: {
    badgeLabel: 'Early access',
    badgeText: 'Free to start — no card needed',
    headingLine1: 'Screenshots in.',
    headingHighlight: 'Scroll-stopping',
    headingRest: 'promo out.',
    subhead:
      'Nimina turns your app screenshots into an animated promo video: real device frames, moving headlines, music on the beat, and an AI Director that drafts the copy. Edit it in your browser and export an MP4 — in 21 languages if you need them.',
    ctaPrimaryLabel: 'Start free',
    ctaPrimaryHref: '/signup',
    ctaSecondaryLabel: 'See the features',
    ctaSecondaryHref: '#features',
    exportBadgeText: 'Rendered right in your browser',
    featuredTemplateId: null,
  },
  template_library: {
    eyebrow: 'Templates',
    heading: 'Start from an edit that already works',
    subhead: 'Each template sets the pacing, device frames, text animation and transitions. Swap in your screenshots and your copy, and it’s done.',
    footerLinkHref: '/templates',
  },
  how_it_works: {
    eyebrow: 'How it works',
    heading: 'From screenshot folder to finished promo',
    steps: [
      { number: '01', title: 'Add your screenshots', body: 'Drop in screenshots of your app. Each one becomes a slide, framed in the device you pick.' },
      {
        number: '02',
        title: 'Let AI draft it, then make it yours',
        body: 'Start from a template, or tell the AI Director what the video is for and it suggests headlines for every slide. Drag, resize and retype anything right on the canvas.',
      },
      { number: '03', title: 'Export for every channel', body: 'Download an MP4 in 9:16, 1:1 or 16:9, up to 4K — plus App Store and Google Play screenshot sizes from the same project.' },
    ],
  },
  feature_bento: {
    heading: 'Built for launching apps',
    subhead: 'Everything a promo video needs, without a video editor.',
    heroTitle: 'AI Director writes the first draft',
    heroBody: 'Tell it what the video is for. It looks at your screenshots and suggests a headline, subtitle, motion, badge and callout for each slide — you review the suggestions before anything changes.',
    features: [
      {
        title: '21 languages, one project',
        body: 'Translate every headline with AI, check each line, and export all languages at once. Arabic and Hebrew run right to left; Japanese and Chinese break lines naturally.',
      },
      { title: 'AI element detection', body: 'Nimina finds the buttons, cards and list items on a screenshot, and lifts the ones you pick out of the screen as animated cut-outs.' },
      { title: 'Real device frames, in 3D', body: 'Island and notch phones, Android, tablet, browser or no frame, in five finishes — straight on or tilted in 3D.' },
      { title: 'Story slides', body: 'Show your app in use: taps, swipes, scrolling, typing, notifications and app launches, played out on your real screens.' },
      { title: 'Music on the beat', body: 'Pick from the music library or upload your own. Trim it, fade it, and snap your slides to the beat.' },
      { title: 'Store screenshots too', body: 'Export App Store and Google Play screenshot sizes from the same slides — no second tool.' },
      { title: 'Edit on the canvas', body: 'Move, scale and rotate headlines, devices, badges and stickers directly on the preview, with snapping guides.' },
    ],
  },
  pricing: {
    heading: 'Simple pricing',
    subhead: 'Start free. Upgrade when you need 4K, more languages and no watermark.',
    plans: [
      { name: 'Free', price: '$0', suffix: 'forever', features: ['1 project', '720p video export, watermarked', 'Phone frames and templates', '3 AI Director drafts a month', '200 MB of storage'], ctaLabel: 'Start free' },
      {
        name: 'Pro',
        price: '$19',
        suffix: '/ month',
        features: [
          'Unlimited projects',
          'Up to 4K, no watermark',
          'Every language + 40 AI translations a month',
          '30 AI Director drafts and 50 element detections a month',
          'Tablet and browser frames, music library',
          'Full-size store screenshots, your own fonts',
          '5 GB of storage',
        ],
        ctaLabel: 'Go Pro',
      },
    ],
  },
  faq: {
    heading: 'Frequently asked questions',
    items: [
      { q: 'Is Nimina available now?', a: 'Nimina is in early access. You can sign up and make videos on the free plan today; features are still being added and polished.' },
      {
        q: 'Do I need design or video-editing skills?',
        a: 'No. Start from a template or let the AI Director draft your headlines, then adjust anything by clicking on it. There is a timeline if you want fine control, but you never have to touch it.',
      },
      { q: 'What can I export?', a: 'MP4 video in 9:16, 1:1 and 16:9 — 720p on Free, up to 4K on Pro — and still images at App Store and Google Play screenshot sizes.' },
      {
        q: 'Which languages are supported?',
        a: '21, including Spanish, German, French, Portuguese, Japanese, Korean, Chinese, Arabic, Hebrew and Hindi. Add languages to a project, translate with AI or by hand, and export them all in one ZIP.',
      },
      {
        q: 'How do the AI features work?',
        a: 'AI Director, element detection and translation send the screenshots or text you choose to our AI provider to analyse, and come back with suggestions you approve. Each plan includes a monthly number of uses.',
      },
      {
        q: "What's the difference between Free and Pro?",
        a: 'Free gives you one project with 720p, watermarked exports. Pro adds unlimited projects, 4K without a watermark, every language, more AI uses, the music library, extra device frames and your own fonts.',
      },
      { q: 'Are my screenshots private?', a: 'Yes. Your uploads are stored privately in your account and only you can open them. You can delete projects — or your whole account — at any time.' },
      { q: 'Can I cancel anytime?', a: 'Yes, from your account page. Videos you exported are yours to keep.' },
    ],
  },
  closing_cta: {
    heading: 'Make your app’s promo video today',
    subhead: 'Drop in your screenshots, let the AI Director draft it, export. Free plan, no credit card.',
    ctaPrimaryLabel: 'Start free',
    ctaPrimaryHref: '/signup',
    ctaSecondaryLabel: 'Browse templates',
    ctaSecondaryHref: '#templates',
  },
  footer: {
    copyrightText: '© 2026 Nimina. All rights reserved.',
    links: [
      { href: '#features', label: 'Features' },
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
