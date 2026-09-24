/**
 * Small, hand-authored Lottie/Bodymovin JSON used to prove the 'lottie'
 * layer type end to end (see templates/showcase.ts). Inlined as plain data
 * — never fetched — so a template's build() stays the only place doing
 * any kind of IO, and playback stays a pure function of time like every
 * other layer (LottieProps.data's doc comment in types.ts).
 *
 * A real project would let a user drop in any exported Lottie JSON; this
 * one is a two-second looping pulse (a single shape layer, one scale
 * keyframe track) — enough to exercise the whole pipeline (lottie-web's
 * canvas renderer → CanvasTexture → PlaneGeometry) without depending on an
 * external asset file.
 */
export const PULSE_SPARK_LOTTIE = {
  v: '5.7.4',
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 200,
  nm: 'Pulse',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Circle',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [100, 100, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: {
          a: 1,
          k: [
            { t: 0, s: [60, 60, 100], e: [100, 100, 100], i: { x: [0.42, 0.42, 0.42], y: [0, 0, 0] }, o: { x: [0.58, 0.58, 0.58], y: [1, 1, 1] } },
            { t: 20, s: [100, 100, 100], e: [72, 72, 100], i: { x: [0.42, 0.42, 0.42], y: [0, 0, 0] }, o: { x: [0.58, 0.58, 0.58], y: [1, 1, 1] } },
            { t: 40, s: [72, 72, 100], e: [60, 60, 100], i: { x: [0.42, 0.42, 0.42], y: [0, 0, 0] }, o: { x: [0.58, 0.58, 0.58], y: [1, 1, 1] } },
            { t: 60 },
          ],
        },
      },
      ao: 0,
      shapes: [
        {
          ty: 'gr',
          it: [
            { ty: 'el', p: { a: 0, k: [0, 0] }, s: { a: 0, k: [140, 140] }, nm: 'Ellipse' },
            { ty: 'fl', c: { a: 0, k: [1, 0.878, 0.4, 1] }, o: { a: 0, k: 100 }, nm: 'Fill' },
            { ty: 'tr', p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
          nm: 'Ellipse Group',
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
};
