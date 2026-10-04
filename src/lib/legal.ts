/**
 * Facts the legal pages (/terms, /privacy, /refunds) and /pricing state about
 * who runs Nimina and how. Change them here, not in the page text, and bump
 * LEGAL_UPDATED whenever a page's meaning changes.
 */
export const LEGAL = {
  /** The person who operates Nimina (not a company). Paddle is the seller. */
  operator: 'Shokhrukh Abdulazizov',
  country: 'the Republic of Uzbekistan',
  courts: 'the competent courts of Tashkent, Uzbekistan',
  email: 'support.nimina@gmail.com',
  /** Money-back window for a first subscription payment or a Lifetime purchase. */
  refundDays: 7,
  minAge: 16,
  updated: '4 October 2026',
} as const;
