import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

/**
 * PKCE callback for both magic-link and Google sign-in — @supabase/ssr's
 * browser client defaults to the PKCE flow, so both signInWithOtp and
 * signInWithOAuth land here with a `code` param to exchange for a session.
 *
 * Supabase can also redirect here directly with an error (e.g. an expired
 * or already-used link) instead of a code — surface that message rather
 * than a generic failure.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/editor';
  const upstreamError = searchParams.get('error_description') || searchParams.get('error');

  if (upstreamError) {
    console.error('[auth/callback] Supabase redirected with an error:', upstreamError);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(upstreamError)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', error.message);
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error.message)}`);
  }

  console.error('[auth/callback] No code or error param on callback request:', request.url);
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent('No sign-in code received.')}`);
}
