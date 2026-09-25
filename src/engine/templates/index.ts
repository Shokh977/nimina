/**
 * All templates: the original 6-template starter set (starter.ts) plus the
 * Nimina Template Pack (docs/TEMPLATE_PACK.md), built in three reviewed
 * batches. `TEMPLATES` is what /templates and the admin content page
 * actually list — everything else imports from here, not from an
 * individual template file.
 */
import { STARTER_TEMPLATES } from './starter';
import { FITNESS_TEMPLATE } from './fitness';
import { FOOD_DELIVERY_TEMPLATE } from './foodDelivery';
import { FINANCE_TEMPLATE } from './finance';
import { SOCIAL_TEMPLATE } from './social';
import { ECOMMERCE_TEMPLATE } from './ecommerce';
import { PRODUCTIVITY_TEMPLATE } from './productivity';
import { SAAS_TEMPLATE } from './saas';
import type { TemplateDef } from './types';

export type { TemplateBuildOptions, TemplateDef, TemplateSlot } from './types';

export const TEMPLATES: TemplateDef[] = [...STARTER_TEMPLATES, FITNESS_TEMPLATE, FOOD_DELIVERY_TEMPLATE, FINANCE_TEMPLATE, SOCIAL_TEMPLATE, ECOMMERCE_TEMPLATE, PRODUCTIVITY_TEMPLATE, SAAS_TEMPLATE];

export function getTemplate(id: string): TemplateDef | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
