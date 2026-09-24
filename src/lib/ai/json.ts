/** Models occasionally wrap JSON in a fenced code block despite instructions
 * not to — shared by every AI module here that expects a bare JSON reply. */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  return JSON.parse(raw.trim());
}
