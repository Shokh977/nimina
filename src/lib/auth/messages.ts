/**
 * Plain-language messages for auth failures, shared by the auth routes and
 * pages. Every message about a specific address is phrased so it never
 * reveals whether that address has an account.
 */

export const MSG = {
  badCredentials:
    'Email or password is incorrect. If you signed up with Google or an email code, use that instead — or reset your password to add one.',
  unverified: 'Verify your email first — we sent you a link and a code when you signed up.',
  badCode: 'That code is wrong or has expired. Check the latest email, or send a new code.',
  codeSent: 'If that email can sign in, a 6-digit code is on its way. It expires in 10 minutes.',
  signUpSent: 'Check your email to verify your account. If you already have an account with this address, sign in instead (or reset your password).',
  resetSent: "If that email has an account, a password reset link is on its way. It expires in an hour. Didn't get it? Check spam, or try again in a minute.",
  resendSent: "If that email is waiting for verification, we've sent a new link and code.",
  rateLimited: (wait: string) => `Too many attempts. Wait ${wait} and try again.`,
  linkExpired: 'That link has expired or was already used. Request a new one.',
  generic: 'Something went wrong on our side. Try again in a moment.',
} as const;

type AuthLikeError = { code?: string; message?: string; status?: number } | null | undefined;

/** Maps a Supabase AuthError to one of the messages above (or a specific
 * one for cases that don't concern another person's address). */
export function friendlyAuthError(err: AuthLikeError, fallback: string = MSG.generic): string {
  if (!err) return fallback;
  const code = err.code ?? '';
  const msg = err.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return MSG.badCredentials;
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(msg)) return MSG.unverified;
  if (code === 'otp_expired' || /token has expired|otp.*(expired|invalid)|invalid.*token/i.test(msg)) return MSG.badCode;
  if (code.startsWith('over_') || err.status === 429 || /rate limit|too many/i.test(msg)) return MSG.rateLimited('a few minutes');
  if (code === 'weak_password') return msg || 'That password is too weak.';
  if (code === 'same_password') return "That's already your password — choose a new one.";
  if (code === 'identity_already_exists') return 'That Google account is already connected to a different Nimina account.';
  if (code === 'single_identity_not_deletable') return "You can't remove your only way to sign in. Add a password first.";
  if (code === 'manual_linking_disabled') return 'Connecting accounts is turned off for this site.';
  if (code === 'email_address_invalid' || /invalid.*email|email.*invalid/i.test(msg)) return 'That email address looks invalid.';
  if (code === 'reauthentication_needed') return 'For security, sign in again before changing this.';
  return fallback;
}
