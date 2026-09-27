import { STATUS_COLOR, STATUS_LABEL, type DashboardProject } from './dashboardData';

export default function ProjectListRow({ project, onOpen, onDuplicate, onDelete }: { project: DashboardProject; onOpen: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const color = STATUS_COLOR[project.status];

  return (
    <div className="flex flex-wrap items-center gap-[18px] px-[18px] py-3.5 transition-colors hover:bg-white/[.03]">
      <div className="h-[52px] w-[78px] shrink-0 overflow-hidden rounded-[9px]" style={{ background: 'linear-gradient(160deg,#1b1e26,#14161c)' }}>
        {project.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a per-project Supabase Storage signed URL, not a static/remote asset next/image can cache
          <img src={project.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div className="min-w-[180px] flex-1">
        <p className="text-[15px] font-semibold text-[#f4f5f8]">{project.name}</p>
        <p className="mt-0.5 text-[13px] text-[#767e8d]">{project.meta}</p>
      </div>

      <div className="flex min-w-[92px] items-center gap-1.5 text-[13.5px] font-medium" style={{ color }}>
        <span className="h-[6px] w-[6px] rounded-full" style={{ background: color }} />
        {STATUS_LABEL[project.status]}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onOpen}
          className="rounded-[10px] bg-[#5b4bff] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_12px_30px_rgba(91,75,255,.4)] transition-colors hover:bg-[#6d5eff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          Open
        </button>
        <button
          onClick={onDuplicate}
          className="rounded-[10px] border border-white/[.16] bg-white/[.03] px-3.5 py-2 text-[13px] font-semibold text-[#c9cdd8] transition-colors hover:bg-white/[.08] hover:text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          Duplicate
        </button>
        <button
          onClick={onDelete}
          className="rounded-[10px] border border-[#ff7a59]/[.28] bg-[#ff7a59]/[.07] px-3.5 py-2 text-[13px] font-semibold text-[#ff8f76] transition-colors hover:bg-[#ff7a59]/[.16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
