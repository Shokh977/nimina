let warned = false;

/** Same graceful-degradation pattern as isSupabaseConfigured()/isPaddleConfigured():
 * the AI Director button stays visible but explains itself instead of
 * crashing until ANTHROPIC_API_KEY is set. */
export function isAiDirectorConfigured(): boolean {
  const configured = !!process.env.ANTHROPIC_API_KEY;
  if (!configured && !warned) {
    warned = true;
    console.warn('[ai] ANTHROPIC_API_KEY is not set — AI Director is disabled. See AGENTS.md for setup steps.');
  }
  return configured;
}
