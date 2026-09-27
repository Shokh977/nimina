import type { ProjectStatus } from './dashboardData';

export type StatusTab = 'all' | ProjectStatus;
export type ViewMode = 'grid' | 'list';

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'rendered', label: 'Rendered' },
];

export default function Toolbar({
  activeTab,
  onTabChange,
  counts,
  search,
  onSearchChange,
  view,
  onViewChange,
}: {
  activeTab: StatusTab;
  onTabChange: (t: StatusTab) => void;
  counts: Record<StatusTab, number>;
  search: string;
  onSearchChange: (v: string) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
}) {
  return (
    <div className="mb-[22px] flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter by status">
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(t.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${
                isActive ? 'border-[#8b7dff]/60 bg-[#5b4bff]/[.18] text-[#cfc8ff]' : 'border-white/[.12] bg-white/[.03] text-[#9aa1af] hover:bg-white/[.08]'
              }`}
            >
              {t.label}
              <span className="rounded-full bg-white/[.07] px-1.5 py-[1px] text-[12px] text-[#9aa1af]">{counts[t.key]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-[42px] items-center gap-2 rounded-[11px] border border-white/[.12] bg-white/[.03] px-3">
          <span aria-hidden className="text-[15px] text-[#5f6675]">
            ⌕
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search projects"
            aria-label="Search projects"
            className="w-[180px] bg-transparent text-[13.5px] text-[#f4f5f8] placeholder:text-[#5f6675] focus:outline-none"
          />
        </div>

        <div className="flex h-[42px] items-center gap-0.5 rounded-[11px] border border-white/[.12] p-1" role="group" aria-label="Layout">
          {(['grid', 'list'] as const).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              aria-pressed={view === v}
              className={`rounded-[8px] px-3 py-[6px] text-[13px] font-medium capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff] ${view === v ? 'bg-[#5b4bff]/[.22] text-[#cfc8ff]' : 'text-[#9aa1af] hover:bg-white/[.06]'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
