import { COMMON_BASES, COMMON_PASSWORDS } from './commonPasswords';

/**
 * Password rules, shared by the browser (strength meter, inline hints) and
 * the server (the actual enforcement — every route that sets a password
 * calls checkPassword before Supabase does). Kept dependency-free.
 */

export const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt (Supabase's hash) ignores bytes past 72

let common: Set<string> | null = null;
let bases: Set<string> | null = null;
/** On the common list, or a common word with only digits/symbols around it
 * (password123, dragon2026!, !!summer1). */
function isCommon(pw: string): boolean {
  if (!common) common = new Set(COMMON_PASSWORDS.split('\n').filter(Boolean));
  if (!bases) bases = new Set([...common, ...COMMON_BASES.split('\n').filter(Boolean)]);
  const lower = pw.toLowerCase();
  if (common.has(lower)) return true;
  const core = lower.replace(/^[^a-z]+/, '').replace(/[^a-z]+$/, '');
  return core.length > 0 && bases.has(core);
}

/** null when acceptable, otherwise the reason in plain language. */
export function checkPassword(password: string, email?: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_LENGTH) return 'That password is too long — keep it under 72 characters.';
  if (isCommon(password)) return 'That password is too common — it appears on lists attackers try first. Pick something less guessable.';
  const local = email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && password.toLowerCase().includes(local)) return "Don't include your email name in your password.";
  if (/^(.)\1+$/.test(password)) return "Don't use a single repeated character.";
  return null;
}

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string };

/** Rough strength for the meter — length plus character variety, with a
 * hard floor for anything checkPassword rejects. Guidance, not policy. */
export function passwordStrength(password: string, email?: string): Strength {
  if (!password) return { score: 0, label: '' };
  if (checkPassword(password, email)) return { score: 0, label: 'Too weak' };
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  let score = 1;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (classes >= 3) score++;
  if (classes <= 1 && password.length < 16) score--;
  const s = Math.max(1, Math.min(4, score)) as 1 | 2 | 3 | 4;
  return { score: s, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][s] };
}
