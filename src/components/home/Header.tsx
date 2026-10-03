import Link from 'next/link';

export default function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-50 border-b border-white/[.08] bg-[#08090c]/78 backdrop-blur-[14px]">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo mark, no benefit from next/image's raster optimizer */}
          <img src="/brand/logo-mark-light.svg" alt="" className="h-[26px] w-[26px] shrink-0" />
          <span className="font-[family-name:var(--font-space-grotesk)] text-[17px] font-bold text-[#f4f5f8]">Nimina</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 sm:flex">
          <a href="#features" className="text-[14px] text-[#9aa1af] transition-colors hover:text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
            Features
          </a>
          <a href="#templates" className="text-[14px] text-[#9aa1af] transition-colors hover:text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
            Templates
          </a>
          <a href="#how" className="text-[14px] text-[#9aa1af] transition-colors hover:text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
            How it works
          </a>
          <Link href="/pricing" className="text-[14px] text-[#9aa1af] transition-colors hover:text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
            Pricing
          </Link>
        </nav>
        <Link
          href={signedIn ? '/projects' : '/login'}
          className="rounded-[10px] bg-[#5b4bff] px-[18px] py-[10px] text-[14px] font-semibold text-white transition-colors hover:bg-[#6d5eff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          Go to app
        </Link>
      </div>
    </header>
  );
}
