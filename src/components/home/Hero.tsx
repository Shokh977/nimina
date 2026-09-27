'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';

import type { HeroContent } from '@/lib/siteContent';
import type { MarketingTemplateCard } from '@/lib/supabase/templates';

function PhoneSkeleton() {
  return (
    <div className="grid h-[190px] w-[96px] grid-rows-[auto_auto_1fr_auto] gap-2.5 rounded-[18px] border-[3px] border-white/70 bg-black/25 p-2.5">
      <div className="h-[7px] w-[70%] rounded-full bg-white/60" />
      <div className="h-[6px] w-[90%] rounded-full bg-white/35" />
      <div className="rounded-lg bg-white/15" />
      <div className="h-4 rounded-md bg-white/70" />
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** The phone-mockup card plays a real template's rendered preview video
 * (picked in /admin/homepage's Hero tab, or auto-picked — see
 * src/app/page.tsx) instead of the old fake color-cycling carousel. The
 * surrounding "browser chrome" frame (traffic-light dots, filename label,
 * transport row) is unchanged; only what's inside it is now real, down to
 * the play/pause button and elapsed/total time actually reflecting the
 * video's real playback state. */
export default function Hero({ content, featuredTemplate }: { content: HeroContent; featuredTemplate: MarketingTemplateCard | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden pt-[92px] pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 h-[620px] w-[1100px] -translate-x-1/2"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(91,75,255,.32), transparent 70%)' }}
      />
      <div aria-hidden className="pointer-events-none absolute top-20 right-[-160px] h-[520px] w-[520px] rounded-full" style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(255,122,89,.16), transparent 70%)' }} />

      <div className="relative mx-auto grid max-w-[1180px] grid-cols-1 gap-14 px-6 lg:grid-cols-[minmax(340px,1fr)_minmax(340px,1fr)] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-2.5 rounded-full border border-white/[.08] bg-white/[.04] py-1.5 pr-4 pl-1.5">
            <span className="rounded-full bg-[#5ee6b5]/[.14] px-2.5 py-[3px] text-[11px] font-semibold text-[#5ee6b5]">{content.badgeLabel}</span>
            <span className="text-[13px] text-[#9aa1af]">{content.badgeText}</span>
          </div>

          <h1 id="hero-heading" className="mt-6 font-[family-name:var(--font-space-grotesk)] text-[clamp(40px,5.4vw,66px)] leading-[1.03] font-bold tracking-[-.03em] text-[#f4f5f8]">
            {content.headingLine1}
            <br />
            <span style={{ backgroundImage: 'linear-gradient(100deg,#8b7dff,#ff9b7a)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{content.headingHighlight}</span> {content.headingRest}
          </h1>

          <p className="mt-6 max-w-[520px] text-[18px] leading-[1.6] text-[#9aa1af]">{content.subhead}</p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={content.ctaPrimaryHref}
              className="rounded-xl bg-[#5b4bff] px-7 py-[15px] text-[15px] font-semibold text-white shadow-[0_14px_34px_rgba(91,75,255,.4)] transition-colors hover:bg-[#6d5eff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
            >
              {content.ctaPrimaryLabel}
            </Link>
            <a
              href={content.ctaSecondaryHref}
              className="rounded-xl border border-white/[.16] bg-white/[.03] px-7 py-[15px] text-[15px] font-semibold text-[#f4f5f8] transition-colors hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
            >
              {content.ctaSecondaryLabel}
            </a>
          </div>

          <div className="mt-9 flex items-center gap-3.5">
            <div className="flex">
              {['linear-gradient(140deg,#5b4bff,#8b7dff)', 'linear-gradient(140deg,#ff7a59,#ffb08f)', 'linear-gradient(140deg,#5ee6b5,#1d8f6c)'].map((g, i) => (
                <span key={i} className="h-7 w-7 rounded-full ring-2 ring-[#08090c]" style={{ background: g, marginLeft: i === 0 ? 0 : -8 }} />
              ))}
            </div>
            <span className="text-[13.5px] text-[#767e8d]">{content.avatarCaption}</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[460px]">
          <div aria-hidden className="pointer-events-none absolute -inset-[26px] rounded-[46px] blur-[46px]" style={{ background: 'linear-gradient(140deg,rgba(91,75,255,.35),rgba(255,122,89,.18))' }} />

          <div className="relative rounded-[22px] border border-white/[.08] bg-[#11131a] p-3 shadow-[0_40px_90px_rgba(0,0,0,.6)]">
            <div className="flex items-center gap-2 px-1.5 py-2">
              <span className="h-[9px] w-[9px] rounded-full bg-[#ff7a59]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#ffd166]" />
              <span className="h-[9px] w-[9px] rounded-full bg-[#5ee6b5]" />
              <span className="ml-2 font-[family-name:var(--font-space-grotesk)] text-[12px] text-[#6d7484]">{featuredTemplate ? `${featuredTemplate.name} · ${featuredTemplate.category}` : 'Preview'}</span>
            </div>

            <div
              className="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[14px]"
              style={{ background: featuredTemplate?.previewVideo9x16 ? '#000' : 'linear-gradient(140deg,#5b4bff,#2a1f8a)' }}
            >
              {featuredTemplate?.previewVideo9x16 ? (
                <video
                  ref={videoRef}
                  src={featuredTemplate.previewVideo9x16}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                />
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <p className="font-[family-name:var(--font-space-grotesk)] text-[20px] font-bold text-white">No preview yet</p>
                  <div className="home-float">
                    <PhoneSkeleton />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 px-1.5 py-3">
              <button
                type="button"
                onClick={togglePlay}
                disabled={!featuredTemplate?.previewVideo9x16}
                aria-label={playing ? 'Pause preview' : 'Play preview'}
                className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#5b4bff] disabled:opacity-50"
              >
                {playing ? (
                  <span className="flex gap-[3px]">
                    <span className="h-3 w-[3px] rounded-sm bg-white" />
                    <span className="h-3 w-[3px] rounded-sm bg-white" />
                  </span>
                ) : (
                  <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-white" />
                )}
              </button>
              <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full transition-[width] duration-150 ease-linear" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%`, background: 'linear-gradient(90deg,#5b4bff,#ff7a59)' }} />
              </div>
              <span className="font-[family-name:var(--font-space-grotesk)] text-[12.5px] tabular-nums text-[#6d7484]">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
          </div>

          <div className="absolute -right-4 -bottom-4 flex items-center gap-2 rounded-full border border-white/[.08] bg-[#14161d] px-3.5 py-2 shadow-[0_16px_30px_rgba(0,0,0,.45)]">
            <span className="home-pulse-dot h-[7px] w-[7px] rounded-full bg-[#5ee6b5]" />
            <span className="text-[12.5px] font-medium text-[#e6e8ee]">{content.exportBadgeText}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
