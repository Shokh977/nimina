import type { SiteContentKey } from './siteContent';

/** Declarative field layout for the /admin/homepage editor — one generic
 * form renderer (SectionEditor.tsx + RepeatableListField.tsx) walks this
 * instead of nine bespoke per-section forms. Three field kinds cover every
 * shape in siteContent.ts: a scalar, a plain list of strings (e.g. a
 * pricing plan's feature bullets), or a list of objects with their own
 * fields (which may itself include a string-list field, e.g. each pricing
 * plan). */
export type PrimitiveKind = 'text' | 'textarea' | 'number' | 'boolean';

export interface PrimitiveField {
  kind: PrimitiveKind;
  key: string;
  label: string;
}

export interface StringListField {
  kind: 'stringList';
  key: string;
  label: string;
  itemLabel: string;
}

export interface ObjectListField {
  kind: 'objectList';
  key: string;
  label: string;
  itemLabel: string;
  itemFields: (PrimitiveField | StringListField)[];
}

/** A dropdown over a live external list (currently just "pick a real
 * template") rather than a fixed set of options — the only field kind
 * whose choices aren't in this schema, since they come from the database.
 * SectionEditor renders it from a `templates` list it's passed alongside
 * the schema. */
export interface TemplateSelectField {
  kind: 'templateSelect';
  key: string;
  label: string;
}

export type SectionField = PrimitiveField | StringListField | ObjectListField | TemplateSelectField;

export interface SectionSchema {
  key: SiteContentKey;
  title: string;
  fields: SectionField[];
}

const p = (kind: PrimitiveKind, key: string, label: string): PrimitiveField => ({ kind, key, label });

export const SITE_CONTENT_SCHEMA: SectionSchema[] = [
  {
    key: 'hero',
    title: 'Hero',
    fields: [
      p('text', 'badgeLabel', 'Badge label'),
      p('text', 'badgeText', 'Badge text'),
      p('text', 'headingLine1', 'Heading — line 1'),
      p('text', 'headingHighlight', 'Heading — highlighted word(s)'),
      p('text', 'headingRest', 'Heading — rest of line 2'),
      p('textarea', 'subhead', 'Subhead'),
      p('text', 'ctaPrimaryLabel', 'Primary button label'),
      p('text', 'ctaPrimaryHref', 'Primary button link'),
      p('text', 'ctaSecondaryLabel', 'Secondary button label'),
      p('text', 'ctaSecondaryHref', 'Secondary button link'),
      p('text', 'avatarCaption', 'Caption next to the avatar stack'),
      p('text', 'exportBadgeText', 'Floating "exported" badge text'),
      { kind: 'templateSelect', key: 'featuredTemplateId', label: 'Featured template (plays inside the phone mockup)' },
    ],
  },
  {
    key: 'logos',
    title: 'Logo marquee',
    fields: [p('text', 'label', 'Label above the logos'), { kind: 'objectList', key: 'items', label: 'Logos', itemLabel: 'Logo', itemFields: [p('text', 'name', 'Name')] }],
  },
  {
    key: 'template_library',
    title: 'Template library',
    fields: [p('text', 'eyebrow', 'Eyebrow'), p('text', 'heading', 'Heading'), p('textarea', 'subhead', 'Subhead'), p('text', 'footerLinkHref', '"See all templates" link')],
  },
  {
    key: 'how_it_works',
    title: 'How it works',
    fields: [
      p('text', 'eyebrow', 'Eyebrow'),
      p('text', 'heading', 'Heading'),
      { kind: 'objectList', key: 'steps', label: 'Steps', itemLabel: 'Step', itemFields: [p('text', 'number', 'Number'), p('text', 'title', 'Title'), p('textarea', 'body', 'Body')] },
    ],
  },
  {
    key: 'feature_bento',
    title: 'Feature grid',
    fields: [
      p('text', 'heading', 'Heading'),
      p('text', 'subhead', 'Subhead'),
      p('text', 'heroTitle', 'Large tile — title'),
      p('textarea', 'heroBody', 'Large tile — body'),
      { kind: 'objectList', key: 'features', label: 'Feature tiles', itemLabel: 'Feature', itemFields: [p('text', 'title', 'Title'), p('textarea', 'body', 'Body')] },
    ],
  },
  {
    key: 'stats',
    title: 'Stats band',
    fields: [{ kind: 'objectList', key: 'items', label: 'Stats', itemLabel: 'Stat', itemFields: [p('text', 'value', 'Value'), p('text', 'label', 'Label')] }],
  },
  {
    key: 'testimonials',
    title: 'Testimonials',
    fields: [
      p('text', 'heading', 'Heading'),
      {
        kind: 'objectList',
        key: 'items',
        label: 'Testimonials',
        itemLabel: 'Testimonial',
        itemFields: [p('textarea', 'quote', 'Quote'), p('text', 'initials', 'Avatar initials'), p('text', 'name', 'Name'), p('text', 'role', 'Role'), p('text', 'avatar', 'Avatar background (CSS gradient)'), p('boolean', 'dark', 'Dark initials text (for light avatar backgrounds)')],
      },
    ],
  },
  {
    key: 'pricing',
    title: 'Pricing',
    fields: [
      p('text', 'heading', 'Heading'),
      p('text', 'subhead', 'Subhead'),
      {
        kind: 'objectList',
        key: 'plans',
        label: 'Plans',
        itemLabel: 'Plan',
        itemFields: [p('text', 'name', 'Name'), p('text', 'price', 'Price'), p('text', 'suffix', 'Price suffix'), { kind: 'stringList', key: 'features', label: 'Features', itemLabel: 'Feature' }, p('text', 'ctaLabel', 'Button label')],
      },
    ],
  },
  {
    key: 'faq',
    title: 'FAQ',
    fields: [p('text', 'heading', 'Heading'), { kind: 'objectList', key: 'items', label: 'Questions', itemLabel: 'Question', itemFields: [p('text', 'q', 'Question'), p('textarea', 'a', 'Answer')] }],
  },
  {
    key: 'closing_cta',
    title: 'Closing CTA',
    fields: [
      p('text', 'heading', 'Heading'),
      p('textarea', 'subhead', 'Subhead'),
      p('text', 'ctaPrimaryLabel', 'Primary button label'),
      p('text', 'ctaPrimaryHref', 'Primary button link'),
      p('text', 'ctaSecondaryLabel', 'Secondary button label'),
      p('text', 'ctaSecondaryHref', 'Secondary button link'),
    ],
  },
  {
    key: 'footer',
    title: 'Footer',
    fields: [p('text', 'copyrightText', 'Copyright text'), { kind: 'objectList', key: 'links', label: 'Links', itemLabel: 'Link', itemFields: [p('text', 'label', 'Label'), p('text', 'href', 'Link')] }],
  },
];

/** A blank value for a freshly-added list item — every field gets its
 * type's empty value so the form renders correctly before the admin fills
 * it in. */
export function emptyItem(fields: (PrimitiveField | StringListField)[]): Record<string, unknown> {
  const item: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.kind === 'boolean') item[f.key] = false;
    else if (f.kind === 'number') item[f.key] = 0;
    else if (f.kind === 'stringList') item[f.key] = [];
    else item[f.key] = '';
  }
  return item;
}
