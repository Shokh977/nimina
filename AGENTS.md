# Promo Studio — Project Brief

## What this is

Promo Studio lets a user upload app screenshots and renders an animated
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
- **Supabase** — auth, Postgres (projects, scenes, user data), file storage
  (uploaded screenshots, app icons, music, exported videos).
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
│   │   │   └── editor/[projectId]/   # the Promo Studio editor page
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
6. **Every animation follows `docs/MOTION_GUIDE.md`.** Springs (not linear/
   cubic easing, except continuous scroll/rotation), stagger, overlap,
   anticipation, idle float, depth/shadow rules, camera behavior, kinetic
   text reveal — all mandatory, in Engine v2 (`src/engine-v2/`) and in the
   editor UI alike. `/dev/compare` exists specifically to catch drift from
   this guide against `legacy/motion-lab-download.html`, the reference
   implementation.
7. **Every rendering-pipeline change (post-processing, color space, tone
   mapping, compositing, materials) must be verified against BOTH a dark,
   hand-tuned template palette AND a real near-white screenshot on a light
   background** — not just one or the other. Three real bugs (a bloom pass
   that glowed the entire screen instead of only bright highlights, a
   selective-bloom fix that let the background bleed through and tint the
   screenshot, and `OutputPass` silently re-applying ACES tone mapping
   regardless of any per-material `toneMapped` flag) all shipped and went
   unnoticed for a full session specifically because every test up to that
   point used dark template content — light, near-white content is what
   exposed all three, immediately and dramatically. `npm run
   visual-regression` (`scripts/visual-regression.mjs`, driving
   `/dev/visual-regression`) is the standing check for this: two fixture
   projects (one dark-palette procedural template, one real light
   screenshot in a device frame), sampling known pixel regions against
   expected values in both preview and a real export. Run it after any
   change that touches `src/engine2/camera.ts`, `sceneBuilder.ts`,
   `grain.ts`, `watermark.ts`, or any material/shader/compositing code, and
   whenever a template or the Motion Lab reference is re-tuned.

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
7. **Verify the storage bucket.** `0003_storage.sql` creates a private
   `assets` bucket with RLS policies — check Storage in the dashboard shows
   an `assets` bucket that is **not** public.
8. **Test it.** `npm run dev`, visit `/login`, try both the magic link
   (check your inbox) and "Continue with Google". On success you land back
   in `/editor` with your email shown top-right and a working Sign out
   button.

The `/projects` grid, `/editor/[id]` project loading, autosave (with a
Saved/Saving indicator), and Storage-backed screenshot/icon/music uploads
are all built on top of this — see `src/components/editor/usePersistence.ts`,
`src/components/projects/`, and `src/lib/supabase/{storage,projects}.ts`.

## Paddle setup (subscriptions)

Same graceful-degradation approach as Supabase: `/pricing` and the webhook
route work without crashing until Paddle env vars are filled in (see
`src/lib/paddle/config.ts`'s `isPaddleConfigured()`) — checkout just shows
"Checkout isn't set up yet." and the webhook returns 503.

1. **Create a Paddle account** at [paddle.com](https://www.paddle.com) and
   switch to **Sandbox** mode (toggle in the dashboard sidebar) — build and
   test entirely in sandbox before ever touching Live mode.
2. **Create the Pro product + prices.** Catalog → Products → new product
   ("Pro"), then add two prices on it: one monthly (recurring), one yearly
   (recurring). Copy each price's ID (`pri_...`).
3. **Get your API credentials.** Developer Tools → Authentication:
   - **Client-side token** (`test_...` in sandbox) → `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
   - **API key** → `PADDLE_API_KEY` (server-only — this can create/cancel
     subscriptions and read customer data; never expose it to the browser)
4. **Create a webhook destination.** Developer Tools → Notifications → New
   destination:
   - For **local development**, Paddle needs a public HTTPS URL to deliver
     to — it can't reach `localhost` directly. Run a tunnel (e.g.
     `ngrok http 3000`) and use the HTTPS URL it gives you, e.g.
     `https://abc123.ngrok-free.app/api/webhooks/paddle`.
   - Subscribe to at least: `subscription.created`, `subscription.updated`,
     `subscription.activated`, `subscription.canceled`,
     `subscription.past_due`, `subscription.paused`, `subscription.resumed`,
     `subscription.trialing`.
   - Copy the destination's **signing secret** → `PADDLE_WEBHOOK_SECRET`.
5. **Fill in `.env.local`**: the two price IDs from step 2, plus the four
   values above, plus `NEXT_PUBLIC_PADDLE_ENV=sandbox`.
6. **Run the new migrations** (`0004_subscriptions.sql`,
   `0005_project_limits.sql`) the same way you ran the earlier ones (CLI
   `supabase db push`, or paste into the SQL Editor in order).

### Testing in sandbox

1. `npm run dev` **and** keep your tunnel (`ngrok http 3000`) running in
   parallel — webhooks only arrive while both are up.
2. Visit `/pricing` signed in, pick Monthly or Yearly, click **Upgrade**.
   Paddle's overlay checkout opens — use one of
   [Paddle's documented sandbox test cards](https://developer.paddle.com/concepts/payment-methods/credit-debit-card#test-a-card-payment)
   to complete it (never a real card; sandbox never charges anything).
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
`src/app/sitemap.ts`, `robots.ts`, `opengraph-image.tsx` (dynamically
generated via `next/og`) — all use `NEXT_PUBLIC_SITE_URL`, so set that to
your real domain before going live or links/canonical URLs will point at
localhost.

**`/privacy`, `/terms`, `/refunds` are placeholder text, clearly marked as
such on the page itself — they must be reviewed (ideally by a lawyer) and
have every bracketed `[...]` filled in before publishing.** They're grounded
in what the app actually does (Supabase for auth/storage, Paddle as
merchant of record) but make no claims beyond that — no specific refund
windows, data-retention periods, or compliance certifications were
invented; those are business/legal decisions left as placeholders.

The marketing layout uses `next/font` (self-hosted Bricolage Grotesque +
Figtree) instead of the `<link>`-tag pattern the editor/login/dev-engine
layouts use — those need exact `ctx.font` family-name matching for canvas
rendering, marketing pages don't. `/`, `/privacy`, `/terms`, `/refunds`
currently render dynamically rather than fully static, because the nav's
signed-in check reads cookies — true static generation for those would
need Next 16's `cacheComponents: true` opt-in, which changes caching
behavior app-wide (including the API routes) and wasn't enabled without
discussing it first; dynamic SSR is still fast in practice.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
