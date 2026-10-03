import sharp from 'sharp';

/** Longest side of a screenshot sent to the model. Phone screenshots are
 * ~2500 px tall; the API would shrink them to 1568 px anyway, and at
 * 1000 px headlines, buttons and their positions still read clearly —
 * for about 2.5× fewer image tokens per screenshot. */
const MAX_SIDE = 1000;

/** A screenshot made ready for a vision request: resized to MAX_SIDE on its
 * long side (never enlarged) and re-encoded as JPEG. Positions the model
 * reports are fractions of the image, so they're unaffected. */
export async function shrinkForAi(input: Buffer): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  const out = await sharp(input, { animated: false })
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  return { base64: out.toString('base64'), mediaType: 'image/jpeg' };
}
