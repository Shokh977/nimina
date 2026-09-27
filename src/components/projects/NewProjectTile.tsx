export default function NewProjectTile({ onClick, creating }: { onClick: () => void; creating: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={creating}
      className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[18px] border border-dashed border-white/[.16] bg-white/[.02] p-6 text-center transition-colors hover:border-[#8b7dff]/50 hover:bg-[#5b4bff]/[.06] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
    >
      <span className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-[#5b4bff]/[.16] text-[20px] text-[#8b7dff]">＋</span>
      <span className="font-[family-name:var(--font-space-grotesk)] text-[16px] font-semibold text-[#f4f5f8]">{creating ? 'Creating…' : 'New project'}</span>
      <span className="max-w-[190px] text-[13.5px] text-[#767e8d]">Drop in screenshots or start from one of 42 premade edits.</span>
    </button>
  );
}
