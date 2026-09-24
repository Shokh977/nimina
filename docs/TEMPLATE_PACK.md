# Template Pack — proposal

**Status: draft, not yet built.** `docs/TEMPLATE_PACK.md` didn't exist before
this — CLAUDE.md's Phase 4 instruction pointed at it as if it did. This is
a from-scratch proposal, built from what the classic engine (`src/engine/`)
actually supports, confirmed by the Phase 3 QA sweep: 6 device frames
(island, notch, punch, tablet, browser, card), 6 frame colors (graphite,
silver, titanium, midnight, rose, theme), 3 output formats (9:16, 1:1,
16:9), 5 text animations (rise, pop, type, slide, letters), 5 transitions
(none, wipe, flash, iris, bars), 3 highlight styles (marker, color,
underline), 5 background patterns (glow, grid, dots, rays, waves), 4
effects (none, confetti, sparkles, stickers), 5 camera moves (none, push,
pull, drift, shake), 2 layouts (single, fan), story slides (a continuous
phone shot driven by actions: launchApp, showScreen, loading, scroll, tap,
longPress, swipe, typeText, highlight, notification, iconAnim, sprite,
successCheck, wait), intro/outro screens, and background music with
SFX-ducking.

**Review this before I build anything.** For each template below: does the
concept fit, is the structure/pacing right, and is the color/style
direction what you want? Flag anything to change — cheap to adjust now,
expensive after 10 templates are built and rendered.

Once approved, each template gets: implementation as a reusable classic-
engine template definition, and a 10-second preview rendered in both 9:16
and 16:9 for the template gallery and landing page (using real, licensable
screenshot content — see the note on assets below).

## A note on preview assets

Phase 3's real-content QA used live-site screenshots (Wikipedia, Hacker
News, GitHub, MDN) captured directly via Playwright — fine for internal
testing, but not something to publish on a public gallery/landing page
without checking attribution/licensing first. For these 10 previews I'll
need either: your own screenshots (of a real or placeholder app), or
procedurally-generated sample content in the same spirit as
`src/dev/sampleProject.ts`'s `makeSample()` (fake, believable UI drawn on
canvas — zero licensing risk, already the pattern the app itself uses to
populate a brand-new project before a user uploads anything). I'd lean
toward the latter for the gallery specifically, since it's guaranteed
clean and I can design each sample screen to match its template's app
category. Flag if you'd rather supply real screenshots instead.

---

## 1. Reactions — social / messaging

**Pitch:** a chat app's reaction feature, playful and kinetic.

- Format: 9:16 primary (chat UI reads naturally tall); 16:9 gallery render
  crops/reflows via the existing format system, no template changes needed.
- Device: `island`, `graphite`. Colors: a violet/pink preset (new —
  `#6D5BFF` → `#FF6FD8`).
- Structure: intro (tagline) → 2 image slides (chat screen, reaction burst
  moment) → text slide (kinetic callout) → outro.
- Text anim: `pop`. Transition: `flash`. Highlight: `marker`.
- Effect: `stickers` (emoji) on the reaction-burst slide. Camera: `push` on
  the hero slide for emphasis.
- Gesture: `tap` overlay on the reaction slide (shows *why* the burst
  happened).

## 2. Streak — fitness / habit tracker

**Pitch:** energetic, stat-forward, built around a streak-celebration
moment (this is close to what `buildDemoProject()`'s sample already shows —
formalizing it as a real template rather than only a dev fixture).

- Format: 9:16. Device: `notch`, `midnight`.
- Colors: cobalt/blue preset (existing PRESETS[0], already tuned).
- Structure: intro → image slide (today's habits) → image slide (weekly
  stats) → image slide (streak celebration, `layout: fan` for a 3-device
  spread) → outro.
- Text anim: `rise`. Transition: `wipe`. Highlight: `color`.
- Effect: `confetti` on the streak slide. Camera: `shake` (handheld, "big
  moment") on the streak slide only, `none` elsewhere — per
  docs guidance elsewhere in this app, motion should be earned, not
  constant.

## 3. Checkout — e-commerce / shopping

**Pitch:** a real add-to-cart → pay → confirmation flow, told as one
continuous **story slide** rather than static screenshots — shows off the
story format's actual strength (a believable, continuous interaction).

- Format: 9:16. Device: `punch`, `graphite`.
- Colors: warm coral/orange preset (`#FF7A59` → `#7A2BFF`, distinct from
  templates 1-2).
- Structure: intro → one story slide (`showScreen` cart → `tap` on Pay →
  `loading` → `successCheck` → `notification` "Order confirmed") → outro.
- Text anim: `slide`. Transition: `iris`. Highlight: `underline`.
- No confetti/effect on the story slide itself (the `successCheck` action
  already reads as the payoff); intro/outro keep the rest of the
  template's usual polish.

## 4. Clarity — productivity / notes

**Pitch:** calm, minimal, the "quiet confidence" register — deliberately
the lowest-energy template in the pack, for apps where hype would read
wrong (note-taking, journaling, focus timers).

- Format: 9:16 and 1:1 both suit this one well (1:1 note: not required by
  the gallery brief, mentioning only as a template-design observation).
- Device: `card` (no frame — content-forward, not device-forward).
  Colors: paper preset (existing PRESETS[4], warm off-white).
- Structure: intro (understated, no confetti/stickers anywhere in this
  template) → 3 image slides (empty state → mid-use → organized result) →
  outro.
- Text anim: `type` (typewriter — reads as "written," on-brand for a notes
  app). Transition: `none` (hard cuts, unhurried). Highlight: `underline`.
- Camera: `drift` throughout (the one continuous-motion exception
  MOTION_GUIDE-style guidance calls out — a slow, ambient drift instead of
  a punchy push).

## 5. Delivery — food / delivery

**Pitch:** appetite-appeal, fast pacing, built around anticipation (a
delivery countdown) resolving into arrival.

- Format: 9:16. Device: `notch`, `rose` frame color (warm, food-adjacent
  without being literally red).
- Colors: sherbet preset (existing PRESETS[1], coral/pink).
- Structure: intro → image slide (browse menu) → image slide (order
  tracking / live map) → image slide (arrived, receipt) → outro.
- Text anim: `letters`. Transition: `bars`. Highlight: `marker`.
- Gesture: `swipeUp` on the browse slide (menu scroll). Camera: `pull` on
  the tracking slide (map "zooming out" feel).

## 6. Ledger — finance / budgeting

**Pitch:** trustworthy, precise, chart-forward — the template that has to
look credible, not just attractive.

- Format: 9:16. Device: `tablet`, `titanium` (the one template that
  deliberately uses the tablet frame — a budgeting/finance app is
  plausible on a larger screen, and it's otherwise untested in the pack).
- Colors: night preset (existing PRESETS[3], dark slate + cyan accent —
  reads as serious/technical, distinct from the warmer templates above).
- Structure: intro → image slide (balance overview) → image slide
  (spending chart) → image slide (goal progress) → outro.
- Text anim: `rise`. Transition: `wipe`. Highlight: `color`.
- No effects (confetti/stickers would undercut the "trustworthy" register).
  Camera: `none` — static, deliberate, nothing playful.

## 7. Horizon — travel / booking

**Pitch:** aspirational, photography-forward, the template most worth
checking in **16:9** specifically (landscape suits travel photography, and
this is a real test of the format beyond "does it technically render").

- Format: 16:9 primary, 9:16 secondary. Device: `browser` for the 16:9 cut
  (a travel-booking site, not just an app) — another frame otherwise
  untested in the pack.
- Colors: grape preset (existing PRESETS[5], purple/violet, evokes
  dusk/aspirational travel photography without needing real photos).
- Structure: intro → image slide (destination browse) → image slide
  (booking flow) → image slide (confirmation) → outro.
- Text anim: `slide`. Transition: `flash`. Highlight: `marker`.
- Camera: `drift` (slow pan, travel-brochure feel).

## 8. Frequency — music / streaming

**Pitch:** dark, neon, high-energy — the "youth/entertainment app" register,
deliberately the most saturated-color template in the pack.

- Format: 9:16. Device: `island`, `midnight`.
- Colors: a new dark-neon preset (`#0E1015` → `#141822`, accent `#7CF0FF`
  cyan — distinct from Ledger's night preset by leaning fully black/neon
  rather than slate).
- Structure: intro → image slide (now-playing) → image slide (playlist/
  discovery) → text slide (kinetic lyric-style callout) → outro.
- Text anim: `pop`. Transition: `bars`. Highlight: `color`.
- Effect: `sparkles` on the now-playing slide. Camera: `push` on the
  kinetic text slide.

## 9. Spark — dating / social matching

**Pitch:** warm, playful, built around a match/connection moment — the
template most similar to Reactions (#1) in energy, deliberately
differentiated by color and by using `swipeLeft` (a gesture no other
template in the pack uses).

- Format: 9:16. Device: `notch`, `rose`.
- Colors: a new warm pink/violet preset (`#FF6FD8` → `#8B5CF6` — shares a
  stop with Reactions' preset but inverted direction and a different
  second color, keeping the two visually related but not identical, which
  is appropriate since they're adjacent categories).
- Structure: intro → image slide (browse/swipe) → image slide (match
  moment) → outro.
- Text anim: `pop`. Transition: `iris`. Highlight: `marker`.
- Gesture: `swipeLeft` on the browse slide. Effect: `confetti` on the match
  slide. Camera: `shake` on the match slide only (mirrors Streak's "earn
  the motion" approach).

## 10. Arcade — gaming / entertainment

**Pitch:** the loudest, most maximalist template in the pack, intentionally
— the pack needs one template that goes all-in on effects/motion so the
gallery shows the engine's full range, not just its restrained end.

- Format: 9:16. Device: `punch`, `silver`.
- Colors: a new high-saturation preset (`#FFD23F` → `#FF3E7F`, yellow to
  hot pink — the brightest preset in the pack by design).
- Structure: intro → image slide (gameplay) → image slide (level-up /
  achievement) → text slide (score callout) → outro.
- Text anim: `letters`. Transition: `bars`. Highlight: `color`.
- Effect: `confetti` **and** `stickers` split across two slides (not
  simultaneously — even the maximalist template shouldn't stack every
  effect on one frame). Camera: `shake` on the achievement slide.

---

## Coverage check

Every device frame, every frame color, all 5 text animations, all 5
transitions, all 3 highlight styles, 4 of 5 background patterns (grid
unused — candidate to swap into one template if you want full pattern
coverage too, flag if so), all 4 effects, and `push`/`pull`/`drift`/`shake`
camera moves each appear at least once; `none` camera is the default
elsewhere. One story-slide template (#3) exercises that format
specifically since it's structurally different enough that every template
using it would be redundant. Six of ten reuse an existing `PRESETS` color
entry (keeps the palette count sane); four introduce a new preset each,
which — if approved — means adding 4 entries to `PRESETS` in
`src/engine/constants.ts`.
