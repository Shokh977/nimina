import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import { LOCALES, localeDef } from '@/engine/locales';

const MODEL = 'claude-opus-5-5';
const MAX_TOKENS = 16000;
const MAX_STRINGS = 300;
const MAX_STRING_LENGTH = 600;

const localeCode = z.string().refine((c) => LOCALES.some((l) => l.code === c), 'Unsupported language');

export const TranslateRequestSchema = z.object({
  sourceLocale: localeCode,
  targetLocale: localeCode,
  appName: z.string().max(200).default(''),
  strings: z
    .array(
      z.object({
        key: z.string().min(1).max(120),
        /** What the string is (headline, button, ...) — context for tone and length. */
        field: z.string().max(40),
        /** Which part of the video it belongs to ('app', 'slide:3', 'outro'). */
        group: z.string().max(40),
        source: z.string().min(1).max(MAX_STRING_LENGTH),
      }),
    )
    .min(1)
    .max(MAX_STRINGS),
});
export type TranslateRequest = z.infer<typeof TranslateRequestSchema>;

/** What the model must return — one entry per input key. */
const TranslationOutput = z.object({
  translations: z.array(z.object({ key: z.string(), text: z.string() })),
});

const SYSTEM_PROMPT = `You localize marketing copy for a mobile app's App Store / Google Play promo video and screenshots. Each string is drawn in large type over a phone mockup, so it has to read as native, punchy marketing copy in the target language — not a literal translation — while keeping the original's meaning and claims (never add features, numbers or promises).

Rules:
- Keep each string about as short as the original. Headlines and buttons have little room; languages that run long should choose tighter phrasing rather than grow.
- Words wrapped in *asterisks* are the highlighted emphasis. Wrap the equivalent emphasized words in your translation in *asterisks* too — the same number of highlighted spans.
  - In languages written with spaces, an asterisk must sit at the very start of the first highlighted word and the very end of the last one — an asterisk inside a word is ignored. Attached prefixes (Arabic و / ب / ل / ال, Hebrew ו / ה / ב / ל) go inside the highlight, and punctuation right after it goes inside too.
    Correct (Arabic): أسعار بسيطة *وواضحة*  — Incorrect: أسعار بسيطة و*واضحة*
    Correct (Arabic): أطلق تطبيقك *اليوم!*  — Incorrect: أطلق تطبيقك *اليوم*!
  - In Chinese and Japanese (no spaces), place the asterisks directly around the emphasized characters: 数分で*プロモーション動画*を作成
- Keep the app name, brand names and product names exactly as given unless the brand is commonly written differently in that market.
- Keep emoji, numbers, currency and units as in the source (localize number formatting only where the target language requires it).
- Buttons and calls to action use the imperative/marketing convention normal for app stores in the target language.
- Strings that are only emoji (stickers) come back unchanged.
- Translate every key you are given, exactly once, using the same keys.`;

/** Asterisk spans must stay balanced or the renderer would highlight the
 * rest of the line — drop the markers rather than ship a broken highlight. */
function balanceHighlights(text: string): string {
  return (text.match(/\*/g)?.length ?? 0) % 2 === 0 ? text : text.replace(/\*/g, '');
}

export interface TranslateResult {
  translations: Record<string, string>;
  /** Keys the model didn't return — the client keeps the existing text for these. */
  missing: string[];
}

export async function runTranslate(apiKey: string, req: TranslateRequest): Promise<TranslateResult> {
  const client = new Anthropic({ apiKey });
  const source = localeDef(req.sourceLocale);
  const target = localeDef(req.targetLocale);

  // Grouped by where each string appears, so related copy is translated in context.
  const groups = new Map<string, TranslateRequest['strings']>();
  for (const s of req.strings) groups.set(s.group, [...(groups.get(s.group) ?? []), s]);
  const listing = [...groups.entries()]
    .map(([group, items]) => {
      const title = group === 'app' ? 'Intro / app name' : group === 'outro' ? 'Closing card' : `Slide ${group.replace('slide:', '#')}`;
      return `## ${title}\n${items.map((s) => `- key: ${JSON.stringify(s.key)} (${s.field})\n  text: ${JSON.stringify(s.source)}`).join('\n')}`;
    })
    .join('\n\n');

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    // Server-side fallback: if a safety classifier declines, the API reruns
    // the same request on the fallback model routed by refusal category.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(TranslationOutput) },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `App name: ${JSON.stringify(req.appName || '(none)')}\nTranslate from ${source.label} (${source.code}) to ${target.label} (${target.code}).\n\n${listing}`,
      },
    ],
  });

  if (response.stop_reason === 'refusal') throw new Error('The translation request was declined.');
  if (response.stop_reason === 'max_tokens') throw new Error('The translation was cut off — try fewer strings at once.');
  const parsed = response.parsed_output;
  if (!parsed) throw new Error('The model returned no usable translation.');

  // Validate against what was asked: only known keys, non-empty text,
  // balanced highlight markers, bounded length.
  const wanted = new Set(req.strings.map((s) => s.key));
  const translations: Record<string, string> = {};
  for (const { key, text } of parsed.translations) {
    const t = text.trim();
    if (!wanted.has(key) || !t || key in translations) continue;
    translations[key] = balanceHighlights(t).slice(0, MAX_STRING_LENGTH * 2);
  }
  return { translations, missing: [...wanted].filter((k) => !(k in translations)) };
}
