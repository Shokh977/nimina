/**
 * Instant placeholders shown by the routes' loading.tsx files while the
 * server renders the page — so a click on /projects, /editor/…, /templates
 * or /pricing changes the screen immediately instead of appearing to do
 * nothing. Each one mirrors its page's layout, so the real page replaces it
 * without things jumping around. Server Components, no data.
 */

function Block({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-[12px] bg-white/[.06] ${className}`} style={style} />;
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark */}
      <img src="/brand/logo-mark-light.svg" alt="" className="h-[26px] w-[26px] shrink-0" />
      <span className="font-[family-name:var(--font-space-grotesk)] text-[17px] font-bold text-[#f4f5f8]">Nimina</span>
    </div>
  );
}

/** Announced to screen readers; visually the skeleton says it. */
function Status({ label }: { label: string }) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}

export function EditorSkeleton() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#08090c]">
      <Status label="Opening the editor…" />
      <div className="flex items-center gap-3.5 border-b border-white/[.07] px-5 py-3">
        <Logo />
        <span className="h-5 w-px bg-white/10" />
        <Block className="h-4 w-36" />
        <div className="ml-auto flex items-center gap-1.5">
          <Block className="h-9 w-9" />
          <Block className="h-9 w-9" />
          <Block className="ml-2 h-9 w-[84px]" />
          <Block className="h-9 w-[78px] bg-[#5b4bff]/40" />
          <Block className="ml-2 h-9 w-9 rounded-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[204px] shrink-0 flex-col gap-2.5 p-3 md:flex">
          {Array.from({ length: 5 }, (_, i) => (
            <Block key={i} className="h-[58px]" />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="grid flex-1 place-items-center p-6">
            <Block className="aspect-[9/16] h-[min(62vh,560px)] rounded-[22px]" />
          </div>
          <div className="flex flex-col gap-3 border-t border-white/[.07] px-[18px] pt-3 pb-4">
            <Block className="h-[42px] w-[42px] rounded-full bg-[#5b4bff]/40" />
            <Block className="h-[58px]" />
            <Block className="h-9" />
          </div>
        </div>
        <div className="hidden w-[316px] shrink-0 flex-col gap-4 border-l border-white/[.07] p-4 lg:flex">
          <Block className="h-9" />
          <Block className="h-28" />
          <Block className="h-20" />
          <Block className="h-20" />
        </div>
      </div>
    </div>
  );
}

export function DashboardSkeleton({ label = 'Loading your projects…' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-[#08090c]">
      <Status label={label} />
      <div className="border-b border-white/[.07]">
        <div className="mx-auto flex max-w-[1320px] items-center justify-between px-6 py-3.5">
          <Logo />
          <Block className="h-9 w-9 rounded-full" />
        </div>
      </div>
      <div className="mx-auto max-w-[1320px] px-6 py-10">
        <Block className="h-9 w-64" />
        <Block className="mt-3 h-4 w-80" />
        <Block className="mt-9 h-10 w-full max-w-[560px]" />
        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-5">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i}>
              <Block className="aspect-[4/3]" />
              <Block className="mt-3 h-4 w-2/3" />
              <Block className="mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** For pages inside the (marketing) layout — its nav and footer stay; this fills the middle. Works in its light and dark themes. */
export function PricingSkeleton() {
  const block = 'animate-pulse rounded-[16px] bg-black/[.06] dark:bg-white/[.06]';
  return (
    <div className="mx-auto max-w-[1100px] px-6 py-16">
      <Status label="Loading pricing…" />
      <div className={`${block} mx-auto h-10 w-72`} />
      <div className={`${block} mx-auto mt-4 h-4 w-96 max-w-full`} />
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className={`${block} h-[420px]`} />
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="min-h-screen bg-[#08090c]">
      <Status label={label} />
      <div className="border-b border-white/[.07]">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-6 py-3.5">
          <Logo />
          <Block className="h-9 w-24" />
        </div>
      </div>
      <div className="mx-auto max-w-[920px] px-6 py-12">
        <Block className="h-9 w-56" />
        <div className="mt-8 grid gap-4">
          <Block className="h-32" />
          <Block className="h-32" />
          <Block className="h-24" />
        </div>
      </div>
    </div>
  );
}
