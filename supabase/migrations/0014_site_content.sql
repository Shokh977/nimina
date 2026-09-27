-- Admin-editable marketing content for the homepage (src/app/page.tsx and
-- its src/components/home/* sections). One row per section, `data jsonb`
-- holding that section's whole shape (see src/lib/siteContent.ts for the
-- matching TypeScript types) — same "flexible jsonb blob, not a column per
-- field" shape as templates.data (0013_template_editor.sql), so adding an
-- editable field later is a data change, not a migration.
--
-- Seed values below are copied verbatim from today's hardcoded components
-- so publishing this migration doesn't change the live page at all —
-- content only changes once an admin edits it in /admin/homepage. Seeds use
-- `on conflict do nothing` so re-running this migration never clobbers an
-- admin's edits.
create table public.site_content (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table public.site_content enable row level security;

-- Marketing copy is public by definition — it's what every visitor sees.
create policy "Anyone can read site content"
  on public.site_content for select
  using (true);

-- Same shape as "Admins can manage templates" (0010_admin.sql).
create policy "Admins can manage site content"
  on public.site_content for all
  using (public.is_admin ())
  with check (public.is_admin ());

insert into public.site_content (key, data) values
('hero', $c$
{
  "badgeLabel": "New",
  "badgeText": "42 ready-made promo templates",
  "headingLine1": "Screenshots in.",
  "headingHighlight": "Scroll-stopping",
  "headingRest": "promo out.",
  "subhead": "Drop in a few app screenshots, pick a premade edit, and Nimina frames them in real devices, animates the copy, and exports a polished MP4. No timeline, no design skills.",
  "ctaPrimaryLabel": "Start free",
  "ctaPrimaryHref": "/login",
  "ctaSecondaryLabel": "Browse templates",
  "ctaSecondaryHref": "#templates",
  "avatarCaption": "12,400+ founders and marketers shipping promos weekly",
  "exportBadgeText": "MP4 exported in 38s",
  "featuredTemplateId": null
}
$c$::jsonb),
('logos', $c$
{"label":"Promos shipped by teams at","items":[{"name":"Northgate"},{"name":"Bloomlet"},{"name":"Kasetta"},{"name":"Orbitly"},{"name":"Finwell"},{"name":"Tidewave"},{"name":"Paperplane"}]}
$c$::jsonb),
('template_library', $c$
{"eyebrow":"Template library","heading":"Start from an edit that already works","subhead":"Every template is a full edit — pacing, device frames, captions and music beds. Swap your screenshots in and it's done.","footerLinkHref":"/login"}
$c$::jsonb),
('how_it_works', $c$
{"eyebrow":"Three steps","heading":"From screenshot folder to finished cut","steps":[
  {"number":"01","title":"Drop your screenshots","body":"Drag in up to 20 PNGs. We detect the device size and crop each one to fit its frame."},
  {"number":"02","title":"Pick a premade edit","body":"Choose a template, then tweak colors, fonts and captions — per slide or across the whole video."},
  {"number":"03","title":"Export and post","body":"Render up to 4K MP4 with 9:16, 1:1 and 16:9 variants of the same cut, ready for every channel."}
]}
$c$::jsonb),
('feature_bento', $c$
{"heading":"Everything a promo video needs","subhead":"The parts an agency would charge you for, built in.","heroTitle":"Real device frames, six finishes","heroBody":"Island and notch phones, Android, tablet and browser mockups — pick the frame that matches your product, in titanium, graphite, or clear.","features":[
  {"title":"Motion that sells it","body":"Beat-matched pans, parallax and text reveals — timed for you, adjustable when you want control."},
  {"title":"Brand kit, applied once","body":"Save logo, colors and type. Every new project opens already looking like you."},
  {"title":"Captions and voiceover","body":"Auto-styled subtitles plus an optional AI read of your script, in eight voices."},
  {"title":"Fast MP4 export","body":"Renders in the cloud in under a minute, up to 4K and 60fps, with no watermark on Pro."}
]}
$c$::jsonb),
('stats', $c$
{"items":[{"value":"42","label":"premade edits"},{"value":"3 min","label":"average time to first cut"},{"value":"190k","label":"videos rendered"},{"value":"4K","label":"export, 60fps"}]}
$c$::jsonb),
('testimonials', $c$
{"heading":"Loved by people who don't edit video","items":[
  {"quote":"I made our App Store teaser on a Tuesday night and it outperformed the agency cut we paid four figures for.","initials":"MR","name":"Maya Rautio","role":"Founder, Kasetta","avatar":"linear-gradient(140deg,#5b4bff,#8b7dff)","dark":false},
  {"quote":"We ship a feature promo with every release now. The template library means nobody has to open After Effects.","initials":"DO","name":"Dele Okafor","role":"Head of Growth, Orbitly","avatar":"linear-gradient(140deg,#ff7a59,#ffb08f)","dark":false},
  {"quote":"Nine vertical variants for a paid test in one afternoon. That used to be a whole sprint of back-and-forth.","initials":"SL","name":"Sara Lindqvist","role":"Performance lead, Finwell","avatar":"linear-gradient(140deg,#5ee6b5,#a8f5d8)","dark":true}
]}
$c$::jsonb),
('pricing', $c$
{"heading":"Simple pricing","subhead":"Start free. Upgrade when you need the watermark gone.","plans":[
  {"name":"Free","price":"$0","suffix":"forever","features":["1 project","720p export, watermarked","8 starter templates","Device frames"],"ctaLabel":"Start free"},
  {"name":"Pro","price":"$19","suffix":"/ month","features":["Unlimited projects","Up to 4K, no watermark","All 42 templates","Brand kit + captions","All aspect-ratio variants"],"ctaLabel":"Go Pro"}
]}
$c$::jsonb),
('faq', $c$
{"heading":"Frequently asked questions","items":[
  {"q":"Do I need design or video-editing skills?","a":"No. Every template is a finished edit — pacing, framing and motion are already set. You add screenshots and swap the copy."},
  {"q":"What formats can I export?","a":"MP4 up to 4K at 60fps, in 9:16, 1:1 and 16:9. Pro renders the same cut in every ratio at once."},
  {"q":"Can I use my own brand colors and fonts?","a":"Yes. Save a brand kit once — logo, palette, type — and every new project opens with it applied."},
  {"q":"What's the difference between Free and Pro?","a":"Free gives you one project at 720p with a watermark and eight templates. Pro unlocks unlimited projects, all 42 templates, 4K and no watermark."},
  {"q":"Can I cancel anytime?","a":"Yes, from your account page. Your exported videos stay yours, and projects remain viewable on the free plan."},
  {"q":"Are my screenshots and projects private?","a":"Always. Uploads are private to your workspace, never used for training, and deletable at any time."}
]}
$c$::jsonb),
('closing_cta', $c$
{"heading":"Your next promo is 3 minutes away","subhead":"Pick a template, drop your screenshots, hit export. Free plan, no credit card.","ctaPrimaryLabel":"Start free","ctaPrimaryHref":"/login","ctaSecondaryLabel":"Browse templates","ctaSecondaryHref":"#templates"}
$c$::jsonb),
('footer', $c$
{"copyrightText":"© 2026 Nimina. All rights reserved.","links":[{"href":"#templates","label":"Templates"},{"href":"/pricing","label":"Pricing"},{"href":"/privacy","label":"Privacy"},{"href":"/terms","label":"Terms"},{"href":"/refunds","label":"Refunds"}]}
$c$::jsonb)
on conflict (key) do nothing;
