# Nimina — Project Brief

## What this is

Nimina lets a user upload app screenshots and renders an animated
promo video from them (device frames, text animations, per-slide styles,
transitions, effects, background music) on an HTML canvas, then exports a
video file. We are turning a working single-file HTML/JS prototype into a
production multi-tenant SaaS web app.

**The prototype lives at [legacy/promo-studio.html](legacy/promo-studio.html)
— read it before touching anything.** It is the source of truth for visual
behavior. It is a fully self-contained, dependency-free page:

- A plain-object `state` (format, color theme, font, device model, per-slide
  `scenes[]`, `intro`/`outro`, music, quality, ...) drives everything.
- A canvas rendering engine: `render(ctx, t, scale)` dispatches per-segment
  to `drawIntro` / `drawOutro` / `drawScene` / `drawTextSlide`, plus
  `drawBg`, `drawDevice` (6 device frame types), `drawWords` (5 text
  animation styles + 3 highlight styles), `drawTransition` (5 styles),
  `drawEffect` (confetti/sparkles/stickers), `drawGesture`, `drawCallout`,
  `drawBadge`, `drawOverlays` (grain/vignette/story bars).
- A timeline model (`segments()`) built from intro + scenes + outro,
  each with a start/duration, used for both scrubbing/playback and export.
- A hand-rolled undo/redo history (deep-clone snapshots, debounced commits).
- Export: draws to an offscreen canvas, uses
  `canvas.captureStream()` + `MediaRecorder` to record MP4 (Chrome/Edge/
  Safari) or WebM (Firefox), with music mixed in via Web Audio
  (`AudioContext.createMediaStreamDestination`).
- Sample screenshots are procedurally generated on canvas (`makeSample`) so
  the editor has content before the user uploads anything.

## Target stack

- **Next.js (App Router) + TypeScript + Tailwind** — app shell, routing,
  marketing pages, editor UI.
- **Zustand** — editor state (replaces the prototype's plain `state` object
  + hand-rolled history).
- **Supabase** — auth, Postgres (projects, scenes, user data).
- **Cloudflare R2** — file storage (uploaded screenshots, app icons, music,
  template previews).
- **Paddle** — subscriptions, as merchant of record (handles tax/invoicing).
- **Vercel** — deployment.

## Planned folder structure

```
/
├── AGENTS.md / CLAUDE.md
├── .env.example
├── legacy/
│   └── promo-studio.html        # prototype, kept as reference — do not edit
├── src/
│   ├── app/                     # Next.js App Router
│   │   ├── (marketing)/         # public marketing pages
│   │   ├── (auth)/              # sign in / sign up
│   │   ├── (app)/
│   │   │   └── editor/[projectId]/   # the Nimina editor page
│   │   └── api/                 # route handlers (Paddle webhooks, etc.)
│   ├── engine/                  # PURE TypeScript canvas engine — NO React,
│   │   │                        # no Next.js imports. Ported 1:1 from the
│   │   │                        # prototype's rendering code.
│   │   ├── render.ts            # top-level render(ctx, t, scale)
│   │   ├── background.ts        # drawBg, drawPattern, drawShapes
│   │   ├── devices.ts           # drawDevice, screenBox, device models
│   │   ├── text.ts              # layoutWords, drawWords, text animations
│   │   ├── transitions.ts       # drawTransition
│   │   ├── effects.ts           # drawEffect, drawGesture, drawCallout, drawBadge
│   │   ├── slides.ts            # drawScene, drawTextSlide, drawIntro, drawOutro
│   │   ├── overlays.ts          # grain, vignette, story bars
│   │   ├── export.ts            # MediaRecorder-based export pipeline
│   │   ├── constants.ts         # FORMATS, PRESETS, FONTS, MODELS, etc.
│   │   └── types.ts             # Project/Scene/state shape (consumed by store)
│   ├── components/
│   │   ├── editor/              # React shell around the engine
│   │   │   ├── Stage.tsx        # canvas element + playback transport
│   │   │   ├── Timeline.tsx
│   │   │   └── panels/          # Slides / Look / Motion / Export tabs
│   │   └── ui/                  # generic UI primitives
│   ├── store/
│   │   └── editorStore.ts       # Zustand store (state shape mirrors engine types)
│   ├── lib/
│   │   ├── supabase/            # browser + server Supabase clients
│   │   ├── paddle/              # Paddle client + webhook verification
│   │   └── utils.ts
│   ├── server/                  # server-only actions / DB access
│   └── styles/
│       └── globals.css          # Tailwind entry point
├── supabase/
│   ├── migrations/
│   └── config.toml
├── public/
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.js
```

This is a proposal, not final — confirm before scaffolding.

## Engine v2 (paused)

A from-scratch, pure-TypeScript, Three.js/WebGL rendering engine was
explored as a possible eventual replacement for the classic canvas engine
below — real 3D camera/depth/lighting, a template-driven content system, a
parallel `/editor2` shell. That work is paused, not deleted: it's preserved
whole on the `engine-v2-wip` branch (see that branch's `STATUS.md` for what
worked, what was broken, and what was mid-flight when it paused). **The
classic engine (`src/engine/`, `/editor`) described below is the sole
shipping engine on `main`.** Nothing under `src/engine2/`, `/editor2`, or
`src/components/editorV2/` exists on this branch — if you're looking for
that code, check out `engine-v2-wip`.

## Rules for all future work in this repo

1. **Preserve the prototype's rendering behavior and visual output exactly**
   unless explicitly asked to change it. When porting engine code, it should
   produce pixel-equivalent output to `legacy/promo-studio.html` for the same
   state/time input.
2. **Keep the canvas rendering engine framework-independent.** Everything
   under `src/engine/` must be pure TypeScript — no React, no Next.js, no
   DOM framework imports. It receives a `CanvasRenderingContext2D` and plain
   data and draws. React components (`src/components/editor/`) call into it;
   it never calls into React.
3. **Never put secret keys in client code.** All secrets (Supabase service
   role key, Paddle API key/webhook secret, etc.) live in server-only
   environment variables. Every environment variable used anywhere in the
   app must be documented in `.env.example`, with a comment on what it's for
   and whether it's public (`NEXT_PUBLIC_*`) or server-only.
4. **Work in small steps.** After each step, explain exactly how to run and
   test it (commands, URLs, what to click/check).
5. **If a decision is ambiguous, ask instead of guessing** (e.g., DB schema
   shape, pricing tiers, which Supabase features to use, exact route
   structure).
6. **Every rendering-pipeline change (drawing code, overlays, or the export
   pipeline) must be verified against the standing visual-regression
   check**, not just eyeballed. `npm run visual-regression`
   (`scripts/visual-regression.mjs`, driving `/dev/visual-regression`,
   fixtures in `src/dev/visualRegressionFixtures.ts`) renders two fixture
   projects (the classic multi-slide demo and the story-format demo) in
   both live preview and a real export, sampling known pixel regions
   against expected values. Preview catches drawing-code regressions;
   export additionally catches color drift introduced by the video
   encode/decode pipeline itself — WebCodecs H.264 limited/full-range and
   color-matrix mismatches are a real, easy-to-miss bug class distinct from
   anything wrong with the drawing code. It also checks that all six engine
   fonts really load and are really used in both preview and export
   (`src/dev/fontCheck.ts`: glyph-shape comparison of rendered text against
   the real font vs. its fallbacks) — the Google Fonts URL once 400'd and
   every font silently fell back to system-ui. Run it after any change touching
   `src/engine/render.ts`, `src/engine/export/`, or any drawing/overlay
   code. If a change is a deliberate visual update, re-calibrate the
   fixtures' expected values against a real render (sample the actual
   output, don't hand-compute) rather than loosening tolerances to make
   them pass.

## Supabase setup

The app degrades gracefully without Supabase configured — `/editor`,
`/login` etc. all still work locally, auth/route-protection is just skipped
with a console warning (see `src/lib/supabase/config.ts`). Do this once
you're ready to test auth and saved projects:

1. **Create the project.** At [supabase.com](https://supabase.com), create
   an account/org, then "New project". Pick a name, a strong database
   password (save it somewhere), and a region. Wait ~2 minutes for
   provisioning.
2. **Copy your API keys.** Project Settings → API:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only —
     bypasses RLS entirely; never expose this to the browser, never prefix
     it `NEXT_PUBLIC_*`, never import it from a Client Component)
3. **Fill `.env.local`.** Copy `.env.example` to `.env.local` and paste the
   three values in.
4. **Enable auth providers.** Authentication → Providers:
   - **Email**: enabled by default; this is what powers the magic-link flow
     (`signInWithOtp`).
   - **Google**: toggle it on, then in
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
     create an OAuth 2.0 Client ID (Application type: Web application) with
     authorized redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`
     (find `<project-ref>` in your project URL). Paste the Client ID and
     Client Secret into Supabase's Google provider settings.
5. **Set redirect URLs.** Authentication → URL Configuration: set Site URL
   to `http://localhost:3000` (add your production URL later, comma
   separated) and add `http://localhost:3000/auth/callback` under Redirect
   URLs — the OAuth/magic-link callback route
   (`src/app/auth/callback/route.ts`) won't be allowed to redirect back
   otherwise.
6. **Run the migrations** in `supabase/migrations/` against your project.
   Either:
   - **Supabase CLI** (recommended): `npm install -g supabase`, then
     `supabase login`, `supabase link --project-ref <project-ref>`,
     `supabase db push`.
   - **Or paste manually**: SQL Editor in the dashboard → paste and run
     each file in `supabase/migrations/` in order (`0001_...`, `0002_...`,
     `0003_...`).
7. **Files are not in Supabase.** Uploads live in Cloudflare R2 — see
   "File storage (Cloudflare R2)". (`0003_storage.sql`'s `assets` bucket is
   the pre-R2 location, kept only as the migration source.)
8. **Test it.** `npm run dev`, visit `/login`, try both the magic link
   (check your inbox) and "Continue with Google". On success you land back
   in `/editor` with your email shown top-right and a working Sign out
   button.

The `/projects` grid, `/editor/[id]` project loading, autosave (with a
Saved/Saving indicator), and R2-backed screenshot/icon/music uploads
are all built on top of this — see `src/components/editor/usePersistence.ts`,
`src/components/projects/`, `src/lib/supabase/projects.ts` and
`src/lib/storage/assets.ts`.

## Paddle setup (subscriptions and one-time payments)

Same graceful-degradation approach as Supabase: `/pricing` and the webhook
route work without crashing until Paddle env vars are filled in (see
`src/lib/paddle/config.ts`'s `isPaddleConfigured()`) — checkout just shows
"Checkout isn't set up yet." and the webhook returns 503.

**Architecture note — pricing has no env-var price IDs at all.** Unlike a
typical Paddle integration, the three billable price points (Pro monthly,
Pro yearly, one-time Lifetime) aren't created by hand in Paddle's
dashboard and pasted into `.env.local` — they're created by this app's own
server code, from `/admin/pricing`, and stored in the append-only
`pricing_config` table (`supabase/migrations/0016_pricing_config.sql`,
logic in `src/lib/paddle/catalog.ts`). An admin types a dollar amount;
the server calls the Paddle API to create a real Product (once, shared
across all three) and a real Price, and records it. **Setting a new
amount always creates a brand-new Paddle price — it never edits an
existing one.** Paddle prices are effectively immutable once created
(changing an existing price's amount would retroactively change what
already-billed customers pay), so a price "change" here means "point
future checkouts at a new price object," while anyone already
subscribed/purchased keeps billing at their original price untouched.
`pricing_config` being append-only (not updated in place) is what lets the
webhook keep recognizing an *old* price id as "this was the lifetime
price" even after an admin sets a new one.

**`/pricing` shows Paddle's own real-time prices, not our stored
`amount_cents`.** `PricingShell.tsx` calls `Paddle.PricePreview()`
client-side for all configured price ids and renders each one's
`formattedTotals.total` string exactly as Paddle returns it — no
`Intl.NumberFormat`, no rounding, no re-formatting, since Paddle's price
preview already accounts for the visitor's currency/tax/locale. The
stored `amount_cents`/`formatPrice()` fallback is only used until that
async call resolves (or if it fails) — it's a flat USD number, never the
final, tax-correct one. The pricing page (`src/app/(marketing)/pricing/
page.tsx`) reads the visitor's country server-side from the
`x-vercel-ip-country` request header (set by Vercel; absent locally and
on other hosts) and passes it to `PricePreview` as `address.countryCode`
**only when it's actually present** — never a synthesized "unknown"
placeholder, so Paddle's own IP-geolocation fallback applies otherwise.
Checkout (`paddle.Checkout.open()`) always passes `settings: {displayMode:
'overlay', variant: 'one-page', successUrl: '<origin>/welcome'}` —
`/welcome` (`src/app/welcome/page.tsx`) is a plain "you're all set,
go to the editor" page; it doesn't itself read `profiles.plan`, since the
webhook that actually flips it can land slightly before or after the
redirect.

**`getPaddleEnv()` (`src/lib/paddle/config.ts`) fails loudly instead of
defaulting.** Every real Paddle call site (`getPaddle()` in `client.ts`,
`createPaddleClient()` in `server.ts`) reads `NEXT_PUBLIC_PADDLE_ENV`
through this function, which throws if it's anything other than exactly
`'sandbox'` or `'production'` — never silently assumes sandbox. Both call
sites are only reached after `isPaddleConfigured()` is true, so hitting
this throw means the account credentials are set but the environment
var specifically isn't — a real misconfiguration worth surfacing loudly
rather than risking a live client token accidentally running against
sandbox (or vice versa).

Lifetime access is deliberately *not* a third `profiles.plan` value — a
completed lifetime purchase just sets `plan = 'pro'` (identical to an
active subscription) and records the transaction in a separate
`purchases` table (`supabase/migrations/0015_lifetime_purchases.sql`).
Every existing plan check in the app (editor/projects pages, AI
Director/element-detect routes, `PLAN_LIMITS`) works unchanged for a
lifetime purchaser. The only place the distinction matters is the webhook
itself: before a canceled/paused *subscription* downgrades someone to
`free`, it checks `purchases` first and skips the downgrade if they
separately bought lifetime access
(`src/app/api/webhooks/paddle/route.ts`'s `syncSubscription`).

**`customers` (`supabase/migrations/0017_customers.sql`) mirrors Paddle's
Customer object**, keyed by Paddle's own customer id, written by the same
webhook (`upsertCustomer()` in `route.ts`, called from every event type
that carries a `customerId`: `subscription.*`, `transaction.completed`,
and `customer.created`/`customer.updated`). Paddle's Customer entity
doesn't carry our `customData`, so a `customer.*` event alone doesn't know
which of our users it belongs to — `upsertCustomer()` resolves the missing
side (user id from email, or email from user id) against `profiles`,
whichever event happens to arrive first. `subscriptions` additionally
tracks `product_id` (which of the shared Pro product's prices was used)
and `scheduled_change_action`/`scheduled_change_at` — set when a customer
cancels/pauses from the portal, but purely informational: Paddle doesn't
execute a scheduled change immediately, so `status` (and therefore
`profiles.plan`, via `subscriptionGrantsAccess()` in
`src/lib/paddle/access.ts`) only changes when it actually takes effect and
fires its own event.

**Guardrail:** the webhook destination + signing secret, the shared Pro
product and its prices, and every row in `customers`/`subscriptions`/
`purchases` are live fulfillment state, not test data — never delete or
suggest deleting any of them, in this repo or in Paddle's dashboard, even
after testing.

1. **Create a Paddle account** at [paddle.com](https://www.paddle.com) and
   switch to **Sandbox** mode (toggle in the dashboard sidebar) — build and
   test entirely in sandbox before ever touching Live mode. Nothing else
   needs to be created by hand in the dashboard — no products, no prices.
2. **Get your API credentials.** Developer Tools → Authentication:
   - **Client-side token** (`test_...` in sandbox) → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
   - **API key** → `PADDLE_API_KEY` (server-only — this now also creates
     products/prices from `/admin/pricing`, in addition to creating
     customer portal sessions and verifying webhooks; never expose it to
     the browser)
3. **Create a webhook destination.** Developer Tools → Notifications → New
   destination:
   - For **local development**, Paddle needs a public HTTPS URL to deliver
     to — it can't reach `localhost` directly. Run a tunnel (e.g.
     `ngrok http 3000`) and use the HTTPS URL it gives you, e.g.
     `https://abc123.ngrok-free.app/api/webhooks/paddle`.
   - Subscribe to at least: `subscription.created`, `subscription.updated`,
     `subscription.activated`, `subscription.canceled`,
     `subscription.past_due`, `subscription.paused`, `subscription.resumed`,
     `subscription.trialing`, **`transaction.completed`** (fires for the
     one-time Lifetime purchase — also fires for every subscription
     renewal, but the webhook ignores those and only acts when the
     transaction's price matches a `pricing_config` row with
     `key = 'lifetime'`), and **`customer.created`**/**`customer.updated`**
     (mirrors Paddle's Customer object into the `customers` table).
   - Copy the destination's **signing secret** → `PADDLE_WEBHOOK_SECRET`.
   - This same destination works for both sandbox and live — when you go
     live, create a second destination under the live account (sandbox and
     production are entirely separate in Paddle) and get a second signing
     secret for your production `.env`.
4. **Fill in `.env.local`**: the three credential values above, plus
   `NEXT_PUBLIC_PADDLE_ENV=sandbox`.
5. **Run the new migrations** (`0004_subscriptions.sql`,
   `0005_project_limits.sql`, `0015_lifetime_purchases.sql`,
   `0016_pricing_config.sql`, `0017_customers.sql`) the same way you ran
   the earlier ones (CLI `supabase db push`, or paste into the SQL Editor
   in order).
6. **Set your prices.** Sign in as an admin, visit `/admin/pricing`, and
   enter an amount for Pro Monthly, Pro Yearly, and Lifetime. Each save
   creates a real (sandbox) Paddle product/price — check Paddle's
   dashboard (Catalog → Products/Prices) to see them appear. `/pricing`
   picks these up automatically; a price you haven't set yet shows
   "Coming soon" there instead of a broken buy button.
7. **Set your default payment link.** This is a dashboard-only setting —
   nothing to do in code. Checkout → Checkout settings → Default payment
   link: set it to a page that can host Paddle's checkout (in sandbox,
   `http://localhost:3000/pricing` is fine; in production, use your real
   `/pricing` URL — Paddle requires an approved domain, see step below on
   going live).

### Testing in sandbox

1. `npm run dev` **and** keep your tunnel (`ngrok http 3000`) running in
   parallel — webhooks only arrive while both are up.
2. Visit `/pricing` signed in, pick Monthly or Yearly, click **Upgrade**.
   Paddle's checkout opens as a one-page overlay
   (`settings: {displayMode: 'overlay', variant: 'one-page'}` in
   `PricingShell.tsx`'s `openCheckout()`) — use one of
   [Paddle's documented sandbox test cards](https://developer.paddle.com/concepts/payment-methods/credit-debit-card#test-a-card-payment)
   to complete it (never a real card; sandbox never charges anything). On
   success Paddle redirects to `/welcome` (`successUrl` in the same
   `settings` object) — confirm that page loads correctly.
3. On success, Paddle fires `subscription.created` (and usually
   `subscription.activated`) to your webhook. Check:
   - Your terminal running `npm run dev` for `[paddle webhook]` log lines
     if anything failed.
   - The `subscriptions` table in Supabase's Table Editor — a row should
     appear for your user.
   - `profiles.plan` for your user should now read `pro`.
   - The editor should immediately reflect it: no watermark, 4K unlocked,
     Pro-only devices/effects selectable.
4. **Test cancellation**: click **Manage subscription** in the user menu
   (opens Paddle's hosted customer portal) and cancel it there, or cancel
   directly from the Paddle sandbox dashboard. Confirm `subscription.canceled`
   arrives and `profiles.plan` flips back to `free`.
5. **Test individual events without a full checkout**: Paddle's dashboard
   has a **Simulate** feature (Developer Tools → Notifications → your
   destination → Simulate, or Developer Tools → Simulations) that sends a
   real signed webhook of whatever event type you pick straight to your
   configured destination — useful for exercising `past_due` or `paused`
   without needing to actually fail a sandbox payment.
6. **Test the project limit**: as a free-plan user, create one project,
   then try to create a second from `/projects` — you should see the
   "Upgrade to Pro" banner instead of a new project being created (this is
   enforced by the RLS policy in `0005_project_limits.sql`, not just the
   UI — you can confirm by trying the insert directly in the SQL Editor as
   that user too).
7. **Test a lifetime purchase** (only if you set a Lifetime amount in
   setup step 6): visit `/pricing` signed in as a free user, click **Buy
   lifetime access** on the Lifetime card, complete checkout with a
   sandbox test card. Confirm `transaction.completed` arrives, a row
   appears in the `purchases` table, and `profiles.plan` reads `pro`. Then
   confirm the downgrade guard: if that same user also has (or later
   starts) a subscription and it gets canceled, `profiles.plan` should
   **stay** `pro` — check the `[paddle webhook]` logs for confirmation, or
   just
   re-run step 4's cancellation test on a lifetime-purchasing user and
   confirm they don't drop to `free`.
8. **Test replacing a price**: from `/admin/pricing`, set a different
   amount for one of the three keys. Confirm a *new* Price object appears
   in Paddle's dashboard (Catalog → Prices) rather than the old one's
   amount changing, that `/pricing` immediately reflects the new amount,
   and that the old price object is still there, untouched.

### Known limitation, by design

The 1-project limit is enforced at the database level (RLS) and can't be
bypassed by a client. The **720p export cap**, **watermark**, and
**Pro-only devices/effects**, however, are enforced in the browser only —
video rendering and encoding happens entirely client-side (see the Prompt 3
WebCodecs export work), so there is no server request to gate at that
point. A determined user could inspect/patch the client bundle to remove
these. This is a real, structural limitation of a client-side rendering
architecture, not an oversight — closing it fully would mean moving
rendering/export to a server, which is a much bigger architectural change.

## Marketing site

Public pages live under `src/app/(marketing)/` (a route group — doesn't
affect URLs): `/` (landing), `/pricing`, `/privacy`, `/terms`, `/refunds`,
sharing `Nav`/`Footer` from `src/components/marketing/`. SEO files:
`src/app/sitemap.ts`, `robots.ts`, `manifest.ts` — all use
`NEXT_PUBLIC_SITE_URL`, so set that to your real domain before going live
or links/canonical URLs will point at localhost. The Open Graph/Twitter
image is a committed static file (`public/brand/og-image.png`, regenerated
via `npm run generate:brand-assets` — see the Brand section below), not a
dynamic `next/og` route.

**`/privacy`, `/terms`, `/refunds` are placeholder text, clearly marked as
such on the page itself — they must be reviewed (ideally by a lawyer) and
have every bracketed `[...]` filled in before publishing.** They're grounded
in what the app actually does (Supabase for auth/storage, Paddle as
merchant of record) but make no claims beyond that — no specific refund
windows, data-retention periods, or compliance certifications were
invented; those are business/legal decisions left as placeholders.

The marketing layout uses `next/font` (self-hosted Bricolage Grotesque +
Figtree) rather than the engine's own font CSS (see Engine fonts below) —
canvas rendering needs exact `ctx.font` family-name matching, marketing
pages don't. `/`, `/privacy`, `/terms`, `/refunds`
currently render dynamically rather than fully static, because the nav's
signed-in check reads cookies — true static generation for those would
need Next 16's `cacheComponents: true` opt-in, which changes caching
behavior app-wide (including the API routes) and wasn't enabled without
discussing it first; dynamic SSR is still fast in practice.

## Engine fonts

Everything the canvas draws uses **self-hosted** fonts — nothing in the
rendering path loads from an external font host (a Google Fonts URL once
returned HTTP 400 and every font silently fell back to system-ui in every
preview and export). `scripts/generate-font-css.mjs` turns the pinned
Fontsource packages into `src/styles/engine-fonts.css` (the 6 Latin engine
fonts, under their exact `FONTS` family names, declared at the weight
instances the engine was designed against) and
`src/styles/script-fonts/*.css` (Noto Sans per non-Latin script). Re-run it
after bumping any `@fontsource*` package.

- `src/components/EngineFonts.tsx` imports the engine CSS; render it on
  every route that draws with the engine (editor, admin, template-preview
  rendering, dev pages).
- Script fonts load on demand (`src/components/scriptFontLoader.ts`,
  dynamic CSS import) — an English-only project never fetches any of them,
  and a localized one only fetches the unicode-range slices for characters
  it actually draws. `ensureProjectFonts()` (`src/engine/fonts.ts`) waits
  for exactly those before any export draws its first frame.
- `npm run visual-regression` blocks Google's font domains outright and
  checks all 6 Latin fonts plus Japanese and Arabic by glyph shape in
  preview and export (`src/dev/fontCheck.ts`).

## Localization

A project's own text is its **source** language; other languages are
override sets in `project.localization` (`src/engine/localization.ts`),
keyed per string (app name, intro tagline, each slide's headline/subtitle/
badge/callout/stickers, story notification/typed text, outro CTA/button/
small print). `localizeProject(project, locale)` returns a render-time copy
with that language's text and a `renderLocale` — the renderer itself only
sees the copy. Under `withTextLocale` (`src/engine/locales.ts`) the engine
then adds the script's Noto font to every font stack, applies the
language's font-size override, breaks Chinese/Japanese lines with
`Intl.Segmenter` (phrase-level refinements and a per-character fallback in
`src/engine/text.ts`), and lays Arabic/Hebrew out right to left (word
order, right alignment, 16:9 columns mirrored; device chrome is never
mirrored). Single-language projects have no `localization` field and render
exactly as before.

UI: Languages tab (translation table, status per string, per-language text
size, overflow flags, "Translate all" via `/api/ai/translate` — reviewed
before anything is applied), the stage's language switcher, and Export →
All languages (one ZIP, a folder per locale). Plan limits: `maxLanguages`
and `maxTranslateUsesPerMonth` in `src/lib/plan.ts`.

## Accounts & sign-in

Three ways in, on `/login` and `/signup` (shared layout in `src/app/(auth)/`):
**email + password** (primary), **email + 6-digit code** (Supabase OTP —
works across devices: request on a laptop, read the code on a phone), and
**Google**. Plus `/forgot-password`, `/reset-password`, `/verify-email` and
`/account` (profile, password, sign-in methods, plan, sessions, data
export, account deletion).

Every email/password/code action goes through a server route in
`src/app/api/auth/*` — that is where the password rules
(`src/lib/auth/password.ts`: 8+ characters, not on the bundled
common-password list or a common word with digits bolted on), the
per-email and per-IP rate limits (`src/lib/auth/rateLimit.ts`,
counted by `public.hit_rate_limit`) and the "never reveal whether an
address is registered" wording (`src/lib/auth/messages.ts`) are enforced.
`app_metadata.has_password` (server-writable only) records whether an
account has a password; magic-link-era accounts without one are offered
a one-time, skippable "add a password" prompt on /projects
(`SetPasswordPrompt`) and keep code sign-in forever.

"Stay signed in" (on by default) is the `nimina-persist` cookie; when off,
every writer of the auth cookies drops their lifetime
(`src/lib/auth/cookies.ts`) so they end with the browser.

Account deletion (`/api/account/delete`) cancels any live Paddle
subscription first (and stops if that fails), deletes the user's R2
folder, projects and auth user. Billing rows (subscriptions, purchases,
customers) are **kept** with `user_id` cleared — migration 0018 changed
those foreign keys from CASCADE to SET NULL.

### Supabase dashboard setup (can't be done from code)

1. **Run migration `0018_accounts.sql`** (rate limits, session listing,
   billing-preserving deletes).
2. **Authentication → Providers → Email**: Email provider on;
   **Confirm email ON** (password sign-ups must verify before they can sign
   in or export); **Secure email change ON**; **Secure password change OFF**
   (the app checks the current password itself; with it on, Supabase
   additionally demands a reauthentication code from sessions older than a
   day); **Email OTP Expiration = 600** seconds (10 minutes); **Email OTP
   Length = 6**.
3. **Authentication → Sign In / Providers → Allow manual linking ON** — needed
   for "Connect Google" on /account.
4. **URL Configuration**: Site URL `https://nimina.vercel.app`; Redirect
   URLs `https://nimina.vercel.app/auth/callback` and
   `http://localhost:3000/auth/callback`.
5. **Custom SMTP (Authentication → Emails → SMTP Settings)** — Supabase's
   built-in sender only allows a handful of emails per hour and is meant for
   testing; every sign-up, code and reset is an email, so launch needs a
   real provider (Resend, Postmark, SES…).
6. **Email templates** (Authentication → Email Templates) — paste exactly,
   keeping each `{{ … }}` on one line. Links use
   `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=…` (verified
   server-side by `/auth/callback`, so they work in any browser), never the
   default `{{ .ConfirmationURL }}` (PKCE — only works in the browser that
   asked, the source of "PKCE code verifier not found in storage").

   **Magic Link** (the sign-in code — code only, no link):
   ```
   Subject: Your Nimina sign-in code: {{ .Token }}
   ```
   ```html
   <h2>Your sign-in code</h2>
   <p style="font-size:30px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>Enter it on the Nimina page you came from — on any device. It expires in 10 minutes and works once.</p>
   <p>If you didn't try to sign in, you can ignore this email.</p>
   ```

   **Confirm signup** (verification — code and link; also used when a new
   address signs up with a code):
   ```
   Subject: Verify your Nimina email — code {{ .Token }}
   ```
   ```html
   <h2>Verify your email</h2>
   <p>Your code is <b style="font-size:22px;letter-spacing:4px">{{ .Token }}</b> — enter it on the page you came from, on any device.</p>
   <p>Or <a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">verify with this link</a>.</p>
   <p>If you didn't create a Nimina account, you can ignore this email.</p>
   ```

   **Reset Password**:
   ```
   Subject: Reset your Nimina password
   ```
   ```html
   <h2>Reset your password</h2>
   <p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Choose a new password</a>. The link works once and expires in an hour.</p>
   <p>If you didn't ask for this, ignore this email — your password stays the same.</p>
   ```

   **Change Email Address**:
   ```
   Subject: Confirm your new Nimina email
   ```
   ```html
   <h2>Confirm your new email</h2>
   <p><a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email_change">Confirm {{ .NewEmail }}</a> as your Nimina sign-in email.</p>
   <p>If you didn't ask for this, ignore this email and nothing will change.</p>
   ```

## File storage (Cloudflare R2)

All files live in Cloudflare R2 (10 GB free, no download fees), not
Supabase Storage. Two buckets:

- **private** (`R2_PRIVATE_BUCKET`): user uploads — screenshots, icons,
  music, project thumbnails — at `{user_id}/{project_id}/{asset_id}`
  (project data stores only the asset id).
- **public** (`R2_PUBLIC_BUCKET`, served at `NEXT_PUBLIC_R2_PUBLIC_URL`):
  `template-previews/{template_id}/preview-{9x16|16x9}.mp4` and
  `music-library/{file}`.

The browser never holds R2 credentials. Uploads: `/api/storage/upload`
checks the signed-in user, the file type and size (`src/lib/storage/rules.ts`)
and builds the key from the user's own id, then returns a pre-signed PUT URL
with the approved Content-Type and Content-Length signed in — R2 rejects any
other file. The browser PUTs straight to R2 (no server function in the
data path, so no 4.5 MB function body limit). Reads: `/api/storage/urls`
signs one-hour GET URLs; `/api/storage/project` copies/deletes a project
folder. Server code uses `src/lib/r2/server.ts`; the S3/SigV4 client is
`src/lib/r2/core.ts` (also used by scripts via `scripts/lib/r2.mjs`).
Background upload failures show in the editor's save badge.

`scripts/migrate-storage-to-r2.mjs` copied the old Supabase Storage files
(dry run by default, `--apply`, `--verify`; never deletes from Supabase).

### Storage limits

Free 200 MB, Pro 5 GB (`maxStorageBytes`, `src/lib/plan.ts`), enforced in
`/api/storage/upload` and `/api/storage/project` (duplicate) through
`public.reserve_storage` (migration 0019): every private file is recorded
in `public.storage_objects` when its upload is approved, atomically under a
per-user lock. Deleting a project deletes its rows (space freed at once).
`recount()` (`src/lib/storage/usage.ts`) re-syncs rows with R2 and deletes
files no project references any more (older than an hour; "referenced" =
the file name appears anywhere in the project's saved JSON, so a new kind
of asset reference can't get a live file deleted). It runs on /account
views and before refusing an upload. `StorageMeter` shows usage in the
editor rail, /projects and /account; the browser also pre-checks against
the last known usage so a file that won't fit never becomes a slide.

### Custom domain for the public bucket

Requires the domain's DNS to be on Cloudflare (R2 custom domains only work
on Cloudflare-managed zones). Bucket → Settings → Custom Domains → Connect
→ e.g. `media.<domain>`; Cloudflare creates the DNS record. Then set
`NEXT_PUBLIC_R2_PUBLIC_URL` to `https://media.<domain>` (Vercel + .env.local),
redeploy, run `node --env-file=.env.local scripts/repoint-public-url.mjs
--apply`, and disable the r2.dev URL.

### R2 setup (Cloudflare dashboard)

1. Create buckets `nimina-private` and `nimina-public`.
2. `nimina-public` → Settings → Public Development URL → enable; that URL
   is `NEXT_PUBLIC_R2_PUBLIC_URL`. (r2.dev is rate-limited — connect a
   custom domain before real traffic.)
3. CORS (each bucket → Settings → CORS policy):
   - private: `[{"AllowedOrigins":["https://nimina.vercel.app","http://localhost:3000"],"AllowedMethods":["GET","PUT","HEAD"],"AllowedHeaders":["content-type"],"MaxAgeSeconds":3600}]`
   - public: `[{"AllowedOrigins":["*"],"AllowedMethods":["GET","HEAD"],"AllowedHeaders":["*"],"MaxAgeSeconds":86400},{"AllowedOrigins":["https://nimina.vercel.app","http://localhost:3000"],"AllowedMethods":["PUT"],"AllowedHeaders":["content-type"],"MaxAgeSeconds":3600}]`
   Add every origin the app runs on (custom domain, etc.) to both.
4. R2 → Manage API tokens → Create: "Object Read & Write", limited to the
   two buckets → `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; the account
   id is `R2_ACCOUNT_ID`. Same six vars in `.env.local` and on the host.

## Phone editor

Below 768px wide (or a touch screen under 500px tall, i.e. a phone in
landscape) — `PHONE_QUERY` in `src/lib/device.ts` — `EditorShellBody`
renders `src/components/editor/mobile/MobileEditor.tsx` instead of the
three-column desktop shell; the desktop layout is untouched. Portrait:
header (undo/redo + a menu holding Preview, Export, AI Director/Languages,
billing, account) · canvas · transport · horizontal slide strip · tab bar
(Slides, Slide, Look, Motion, Export) opening a draggable bottom sheet.
Landscape docks the section beside the canvas instead. The root is pinned
to `window.visualViewport`, so the sheet and a focused field stay above
the on-screen keyboard. `Stage` has a `touch` mode: pinch zoom (re-renders
sharp on release, max 3×), two-finger pan, taps still reach the
tap-to-edit text. Panels are shared with desktop; `data-touch-ui` rules in
`globals.css` give every control a 44px target and fields 16px text (no
iOS focus zoom), and form rows are `grid-cols-1 md:grid-cols-2`. Phones
export at most 720p (`deviceExportCap`, with a note in the Export panel).

## Operations

Backups (weekly pg_dump to R2, proven by an automatic restore), the
restore procedure and the Supabase keep-alive cron are documented in
[README.md](README.md). Backups run in GitHub Actions
(`.github/workflows/db-backup.yml`, `scripts/backup/`); the keep-alive is a
Vercel Cron (`vercel.json`, `/api/cron/keepalive`, needs `CRON_SECRET`).

## Brand

Source assets live in `public/brand/` (SVGs, plus generated raster files —
regenerate the latter with `npm run generate:brand-assets` after changing
any source SVG, via `scripts/generate-brand-assets.mjs`).

- **Which file on which background**: `logo-mark-dark.svg` /
  `logo-full-dark.svg` (ink-colored mark) on **light** backgrounds;
  `logo-mark-light.svg` / `logo-full-light.svg` (white mark) on **dark**
  backgrounds. `favicon.svg` is a standalone self-contained badge (ink
  square + white mark) — always legible on its own, used as-is for the
  favicon/app icons. `favicon-small.svg` is a simplified variant (wider gap
  between the N-shape and the triangle) used **only** for the 16/32px
  favicon renders, where the standard mark's gap anti-aliases into a blob;
  `favicon-180.png`/`icon-192.png`/`icon-512.png` render from the real
  `favicon.svg` since they're large enough to stay legible.
- **Colors**: ink `#121317` (mark-on-light fill, favicon badge background —
  distinct from the general dark-UI background `#08090c` used elsewhere in
  the app, don't conflate the two); light mark `#FFFFFF`; primary accent
  `#5b4bff` (solid CTAs); accent hover/highlight `#8b7dff`.
- **The export watermark is drawn from `public/brand/nimina-mark-path.json`
  via `Path2D` on the canvas** (`src/engine/overlays.ts` `drawWatermark`),
  never rasterized from an SVG/image — that's what keeps it crisp at 4K
  export resolutions. The path data is duplicated as a small constant
  inside `overlays.ts` (the pure-TS engine doesn't import from `public/`);
  keep the two in sync if the mark ever changes.
- **Auth emails**: see "Accounts & sign-in" above for the exact
  Supabase email templates.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
