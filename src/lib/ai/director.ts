import Anthropic from '@anthropic-ai/sdk';

import { extractJson } from './json';
import { DirectorResponseSchema, type DirectorResponse } from './schema';

const MODEL = 'claude-sonnet-5';
const MAX_TOKENS = 2000;

export interface DirectorImage {
  sceneId: number;
  base64: string;
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
}

const SYSTEM_PROMPT = `You are the "AI Director" for Nimina, a tool that turns app screenshots into short promo videos.
You'll be shown one or more screenshots, each labeled with its "sceneId" (an existing slide in the user's project), plus the user's stated goal for the video.

Suggest concrete, tasteful edits to make each slide land better: a punchier headline, an optional one-line subtitle, a device motion style, an optional effect, an optional short badge (like "New" or "50% off"), and an optional callout label pointing at something on screen.

Reply with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "summary": "one or two sentences explaining your overall approach",
  "slides": [
    { "sceneId": <number, must match one of the sceneIds you were shown>, "headline": "<optional, <=80 chars, wrap words to highlight in *stars*>", "sub": "<optional, <=120 chars>", "anim": "<optional: rise|pop|slide|swing|spotlight>", "effect": "<optional: none|confetti|sparkles|stickers>", "badge": "<optional, <=20 chars>", "callout": "<optional, <=28 chars>" }
  ]
}
Only include fields you actually want to change — omit any you'd leave as-is. Only suggest one slide entry per sceneId you were shown.`;

/**
 * Calls Claude with vision, validates the JSON response against
 * DirectorResponseSchema, and retries once (in the same conversation, with
 * the validation error fed back) if the first reply doesn't parse or
 * doesn't match the schema. Throws if the retry also fails.
 */
export async function runDirector(apiKey: string, goal: string, images: DirectorImage[]): Promise<DirectorResponse> {
  const anthropic = new Anthropic({ apiKey });

  const imageBlocks: Anthropic.ContentBlockParam[] = images.map((img) => ({
    type: 'image',
    source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
  }));
  const labelBlocks: Anthropic.ContentBlockParam[] = images.map((img, i) => ({
    type: 'text',
    text: `Screenshot ${i + 1} above is sceneId ${img.sceneId}.`,
  }));

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: [{ type: 'text', text: `Goal for this promo video: ${goal}` }, ...imageBlocks, ...labelBlocks],
    },
  ];

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await anthropic.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system: SYSTEM_PROMPT, messages });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
    const text = textBlock?.text ?? '';

    try {
      const parsed = extractJson(text);
      const validated = DirectorResponseSchema.parse(parsed);
      const allowedIds = new Set(images.map((img) => img.sceneId));
      validated.slides = validated.slides.filter((s) => allowedIds.has(s.sceneId));
      return validated;
    } catch (err) {
      if (attempt === 1) throw new Error(`AI Director returned an invalid response: ${err instanceof Error ? err.message : String(err)}`);
      const errorDetail = err instanceof Error ? err.message : String(err);
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: `That wasn't valid JSON matching the required shape (${errorDetail}). Reply again with ONLY the corrected JSON object.` });
    }
  }

  // Unreachable — the loop always returns or throws on its second iteration.
  throw new Error('AI Director failed.');
}
