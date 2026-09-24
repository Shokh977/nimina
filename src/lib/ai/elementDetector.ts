import Anthropic from '@anthropic-ai/sdk';

import { extractJson } from './json';
import { DetectElementsResponseSchema, type DetectElementsResponse } from './schema';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 1200;

const SYSTEM_PROMPT = `You detect UI elements in a single app screenshot for Promo Studio, a tool that turns screenshots into promo videos with "cutouts" — pieces of the screenshot that pop out and animate on their own.

Find buttons, cards, list items and chat/message bubbles worth pulling out as their own animated layer. Skip decorative background, plain text paragraphs, and the status bar.

Reply with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "elements": [
    { "kind": "button" | "card" | "list-item" | "bubble", "label": "<short human label, e.g. \\"Pay button\\" or \\"Product card\\">", "rect": { "x": <0-1 left>, "y": <0-1 top>, "w": <0-1 width>, "h": <0-1 height> } }
  ]
}
Coordinates are fractions of the full image (0,0 = top-left, 1,1 = bottom-right). Return at most 8 of the clearest, most useful elements — better to return fewer confident ones than to guess.`;

/**
 * Calls Claude with vision on one screenshot, validates the JSON response
 * against DetectElementsResponseSchema, and retries once (in the same
 * conversation, with the validation error fed back) if the first reply
 * doesn't parse or match the schema. Throws if the retry also fails.
 * Mirrors runDirector's shape (src/lib/ai/director.ts) — same model,
 * same retry-once pattern, same fenced-JSON tolerance.
 */
export async function runElementDetector(apiKey: string, base64: string, mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'): Promise<DetectElementsResponse> {
  const anthropic = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: 'Find buttons, cards, list items and bubbles in this screenshot.' },
      ],
    },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, messages });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock?.text ?? '';

    try {
      const parsed = extractJson(text);
      return DetectElementsResponseSchema.parse(parsed);
    } catch (err) {
      if (attempt === 1) throw new Error(`Element detection returned an invalid response: ${err instanceof Error ? err.message : String(err)}`);
      const errorDetail = err instanceof Error ? err.message : String(err);
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: `That wasn't valid JSON matching the required shape (${errorDetail}). Reply again with ONLY the corrected JSON object.` });
    }
  }

  // Unreachable — the loop always returns or throws on its second iteration.
  throw new Error('Element detection failed.');
}
