import Nav from './Nav';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';

/** Isolates the auth check behind a Suspense boundary (see the marketing
 * layout) so it alone streams in dynamically, while the rest of a page like
 * /privacy or /terms — which don't depend on auth state — can still be
 * statically generated. */
export default async function NavAuthSlot() {
  let signedIn = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = !!user;
  }
  return <Nav signedIn={signedIn} />;
}
