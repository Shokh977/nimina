/**
 * Starter Projects — pre-styled slide sequences the user fills in with
 * their own screenshots via /templates's wizard, instead of building a
 * promo from a blank project. Each template's `build()` returns a full
 * `Project` whose image slides have `imgAssetId: null` — those are the
 * "slots" the wizard prompts for, matched up by `slots[].sceneId`.
 *
 * Kept in the engine (pure TypeScript, no React) since a template is just a
 * specific Project value, the same kind of data createDefaultProject()
 * produces — not UI. See supabase/migrations/0008_templates.sql for the
 * (metadata-only) `templates` table that lets an admin enable/reorder
 * these without a deploy; the Project-building logic itself stays in code.
 */
import { PRESETS } from '../constants';
import { createImageSlide, createTextSlide } from '../slides';
import type { Project } from '../types';
import type { TemplateDef, TemplateSlot } from './types';

export type { TemplateDef, TemplateSlot };

function base(overrides: Partial<Project> = {}): Omit<Project, 'scenes'> {
  return {
    format: '9:16',
    preset: 0,
    colors: { ...PRESETS[0] },
    font: 0,
    model: 'island',
    fcolor: 'graphite',
    bgPattern: 'glow',
    shapes: true,
    grain: false,
    vignette: false,
    storyBars: false,
    hlStyle: 'marker',
    textPos: 'top',
    textAnim: 'rise',
    transition: 'wipe',
    appName: '',
    intro: { on: true, dur: 2.5, tagline: '', style: {} },
    iconAssetId: null,
    outro: { on: true, dur: 3, cta: '', button: 'Download free', small: '', style: {} },
    quality: '1080',
    music: null,
    volume: 0.8,
    ducking: true,
    ...overrides,
  };
}

export const STARTER_TEMPLATES: TemplateDef[] = [
  {
    id: 'app-launch',
    name: 'App Launch',
    description: 'Punchy, energetic intro for a brand-new app — three screenshots with confident motion.',
    category: 'Launch',
    swatch: ['#3347FF', '#0C1662'],
    durationSeconds: 17.5,
    build: () => {
      let id = 1;
      const project: Project = {
        ...base({ intro: { on: true, dur: 2.5, tagline: 'Introducing *your app*', style: {} }, outro: { on: true, dur: 3, cta: 'Get started *today*', button: 'Download free', small: 'On iPhone and Android', style: {} } }),
        scenes: [
          createImageSlide(id++, null, { headline: 'Everything you need, *in one place*', anim: 'rise', dur: 4 }),
          createImageSlide(id++, null, { headline: 'Built to be *fast*', sub: 'No lag, no waiting.', anim: 'pop', dur: 4, gesture: 'tap' }),
          createImageSlide(id++, null, { headline: 'Ready when *you* are', anim: 'slide', dur: 4, badge: 'New' }),
        ],
      };
      const slots: TemplateSlot[] = project.scenes.filter((s) => s.kind === 'image').map((s, i) => ({ key: String(s.id), targets: [{ sceneId: s.id }], label: `Screenshot ${i + 1}`, hint: ['Home / main screen', 'Key feature in action', 'Final screen or results'][i] }));
      return { project, slots };
    },
  },
  {
    id: 'feature-highlight',
    name: 'Feature Highlight',
    description: 'Calm, focused spotlight on one feature — a statement slide followed by two close-up screenshots.',
    category: 'Feature',
    swatch: ['#2B2F3A', '#0E1015'],
    durationSeconds: 14,
    build: () => {
      let id = 1;
      const project: Project = {
        ...base({ preset: 3, colors: { ...PRESETS[3] }, intro: { on: false, dur: 2.5, tagline: '', style: {} }, outro: { on: true, dur: 3, cta: 'Try it *yourself*', button: 'Get the app', small: '', style: {} } }),
        scenes: [
          createTextSlide(id++, { headline: 'One feature *changes everything*', dur: 2.5 }),
          createImageSlide(id++, null, { headline: 'See it *in action*', anim: 'spotlight', dur: 4.5, focus: { x: 0.5, y: 0.4 } }),
          createImageSlide(id++, null, { headline: 'Simple. *Powerful.*', anim: 'rise', dur: 4, callout: 'Tap to try' }),
        ],
      };
      const slots: TemplateSlot[] = project.scenes.filter((s) => s.kind === 'image').map((s, i) => ({ key: String(s.id), targets: [{ sceneId: s.id }], label: `Screenshot ${i + 1}`, hint: ['The feature, zoomed in', 'The feature being used'][i] }));
      return { project, slots };
    },
  },
  {
    id: 'before-after',
    name: 'Before / After',
    description: 'A clean two-shot comparison — set the scene, then show the improvement.',
    category: 'Comparison',
    swatch: ['#DDF5E8', '#86D3AF'],
    durationSeconds: 10.5,
    build: () => {
      let id = 1;
      const project: Project = {
        ...base({ preset: 2, colors: { ...PRESETS[2] }, intro: { on: false, dur: 2.5, tagline: '', style: {} }, outro: { on: true, dur: 3, cta: 'See the *difference*', button: 'Download free', small: '', style: {} } }),
        scenes: [
          createImageSlide(id++, null, { headline: '*Before*', sub: 'The old way.', anim: 'rise', dur: 3.5 }),
          createImageSlide(id++, null, { headline: '*After*', sub: 'So much better.', anim: 'pop', dur: 4, effect: 'sparkles' }),
        ],
      };
      const slots: TemplateSlot[] = project.scenes.filter((s) => s.kind === 'image').map((s, i) => ({ key: String(s.id), targets: [{ sceneId: s.id }], label: i === 0 ? 'Before screenshot' : 'After screenshot', hint: i === 0 ? 'The old/cluttered state' : 'The improved result' }));
      return { project, slots };
    },
  },
  {
    id: 'testimonial',
    name: 'Social Proof',
    description: 'Lead with a quote or rating, then back it up with one great screenshot.',
    category: 'Trust',
    swatch: ['#FFA38F', '#E94B75'],
    durationSeconds: 10,
    build: () => {
      let id = 1;
      const project: Project = {
        ...base({ preset: 1, colors: { ...PRESETS[1] }, intro: { on: false, dur: 2.5, tagline: '', style: {} }, outro: { on: true, dur: 3, cta: 'Join *thousands* of happy users', button: 'Download free', small: '', style: {} } }),
        scenes: [
          createTextSlide(id++, { headline: '"*Absolutely* love this app"', sub: '— a happy user', dur: 3 }),
          createImageSlide(id++, null, { headline: 'Rated *4.9 stars*', anim: 'rise', dur: 4, badge: '4.9 ★' }),
        ],
      };
      const slots: TemplateSlot[] = project.scenes.filter((s) => s.kind === 'image').map((s) => ({ key: String(s.id), targets: [{ sceneId: s.id }], label: 'Screenshot', hint: 'Your best, most polished screen' }));
      return { project, slots };
    },
  },
  {
    id: 'sale-promo',
    name: 'Sale / Promo',
    description: 'Bold and loud — a limited-time offer with confetti and a strong call to action.',
    category: 'Promo',
    swatch: ['#8B5CF6', '#3B0F7A'],
    durationSeconds: 13,
    build: () => {
      let id = 1;
      const project: Project = {
        ...base({ preset: 5, colors: { ...PRESETS[5] }, intro: { on: true, dur: 2, tagline: '*Limited time* offer', style: {} }, outro: { on: true, dur: 3.5, cta: 'Save *50%* today', button: 'Claim offer', small: 'Ends soon', style: {} } }),
        scenes: [
          createImageSlide(id++, null, { headline: '*50% off* everything', anim: 'pop', dur: 4, effect: 'confetti', badge: 'Sale' }),
          createImageSlide(id++, null, { headline: "Don't *miss out*", anim: 'swing', dur: 3.5 }),
        ],
      };
      const slots: TemplateSlot[] = project.scenes.filter((s) => s.kind === 'image').map((s, i) => ({ key: String(s.id), targets: [{ sceneId: s.id }], label: `Screenshot ${i + 1}`, hint: 'A screen that shows the offer or product' }));
      return { project, slots };
    },
  },
  {
    id: 'update-announcement',
    name: "What's New",
    description: 'Announce a fresh update — a headline slide followed by the new features themselves.',
    category: 'Update',
    swatch: ['#F7F4EE', '#E0D8C8'],
    durationSeconds: 12.5,
    build: () => {
      let id = 1;
      const project: Project = {
        ...base({ preset: 4, colors: { ...PRESETS[4] }, intro: { on: false, dur: 2.5, tagline: '', style: {} }, outro: { on: true, dur: 3, cta: 'Update *now*', button: 'Update', small: '', style: {} } }),
        scenes: [
          createTextSlide(id++, { headline: "*What's new* this month", dur: 2.5 }),
          createImageSlide(id++, null, { headline: 'Feature one', anim: 'rise', dur: 3.5, badge: 'New' }),
          createImageSlide(id++, null, { headline: 'Feature two', anim: 'slide', dur: 3.5, badge: 'New' }),
        ],
      };
      const slots: TemplateSlot[] = project.scenes.filter((s) => s.kind === 'image').map((s, i) => ({ key: String(s.id), targets: [{ sceneId: s.id }], label: `Feature ${i + 1} screenshot`, hint: 'A screen showing the new feature' }));
      return { project, slots };
    },
  },
];
