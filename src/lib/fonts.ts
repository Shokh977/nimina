import { Instrument_Sans, Space_Grotesk } from 'next/font/google';

/** Shared by the dark-theme, self-contained pages that don't use
 * (marketing)'s Bricolage Grotesque/Figtree + light/dark-toggle theme —
 * currently the homepage (src/app/page.tsx) and the signed-in dashboard
 * (src/components/projects/). */
export const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-space-grotesk' });
export const instrumentSans = Instrument_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-instrument-sans' });
