/** Lowercase, alphanumeric-and-hyphen slug from arbitrary text — used for
 * both the one-time template import and the admin "duplicate" action. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Appends -2, -3, ... until `candidate` isn't in `taken`. */
export function uniqueSlug(candidate: string, taken: Set<string>): string {
  if (!taken.has(candidate)) return candidate;
  let i = 2;
  while (taken.has(`${candidate}-${i}`)) i++;
  return `${candidate}-${i}`;
}
