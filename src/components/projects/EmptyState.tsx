export default function EmptyState({ filtered, query, onClear }: { filtered: boolean; query: string; onClear: () => void }) {
  if (!filtered) {
    return (
      <div className="rounded-[18px] border border-dashed border-white/[.16] bg-white/[.02] px-6 py-[70px] text-center">
        <p className="font-[family-name:var(--font-space-grotesk)] text-[20px] font-semibold text-[#f4f5f8]">No projects yet</p>
        <p className="mt-2 text-[15px] text-[#9aa1af]">Start from a blank canvas or pick a template — either way you&apos;re editing in seconds.</p>
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border border-dashed border-white/[.16] bg-white/[.02] px-6 py-[70px] text-center">
      <p className="font-[family-name:var(--font-space-grotesk)] text-[20px] font-semibold text-[#f4f5f8]">{query ? <>No projects match &ldquo;{query}&rdquo;</> : 'No projects match this filter'}</p>
      <p className="mt-2 text-[15px] text-[#9aa1af]">Try another name, or clear the filters to see everything.</p>
      <button
        onClick={onClear}
        className="mt-6 rounded-xl border border-white/[.16] bg-white/[.03] px-5 py-2.5 text-[14px] font-semibold text-[#f4f5f8] transition-colors hover:bg-white/[.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
      >
        Clear filters
      </button>
    </div>
  );
}
