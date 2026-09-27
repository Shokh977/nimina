import { STATUS_COLOR, STATUS_LABEL, type DashboardProject } from './dashboardData';

export default function ProjectGridCard({ project, onOpen, onDuplicate, onDelete }: { project: DashboardProject; onOpen: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const color = STATUS_COLOR[project.status];

  return (
    <div className="group overflow-hidden rounded-[18px] border border-white/[.08] bg-[#11131a] transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-[#8b7dff]/45">
      <div className="relative flex aspect-[3/4] items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(160deg,#1b1e26,#14161c)' }}>
        {project.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a per-project Supabase Storage signed URL, not a static/remote asset next/image can cache
          <img src={project.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}

        <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-[#08090c]/60 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur-sm" style={{ color }}>
          <span className="h-[6px] w-[6px] rounded-full" style={{ background: color }} />
          {STATUS_LABEL[project.status]}
        </span>

        {!project.thumbnailUrl && (
          <div className="flex flex-col items-center gap-2 text-[#6d7484]">
            <span className="grid h-[42px] w-[42px] place-items-center rounded-xl border-2 border-dashed border-current text-[18px]">＋</span>
            <span className="text-[12px] font-medium">No preview yet</span>
          </div>
        )}

        <div className="absolute right-3 bottom-3 left-3 flex items-center gap-2">
          <button
            onClick={onOpen}
            className="flex-1 rounded-[10px] bg-[#5b4bff] py-2 text-[13px] font-semibold text-white shadow-[0_12px_30px_rgba(91,75,255,.4)] transition-colors hover:bg-[#6d5eff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
          >
            Open editor
          </button>
          <button
            onClick={onDuplicate}
            aria-label="Duplicate project"
            title="Duplicate"
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] border border-white/[.18] bg-[#08090c]/70 text-[15px] text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
          >
            ⧉
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-[15px_17px]">
        <div>
          <h3 className="text-pretty font-[family-name:var(--font-space-grotesk)] text-[16px] font-semibold text-[#f4f5f8]">{project.name}</h3>
          <p className="mt-1 text-[13px] text-[#767e8d]">{project.meta}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onDuplicate} className="flex-1 rounded-[9px] border border-white/[.16] bg-white/[.03] py-2 text-[13px] font-semibold text-[#c9cdd8] transition-colors hover:bg-white/[.08] hover:text-[#f4f5f8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]">
            Duplicate
          </button>
          <button
            onClick={onDelete}
            className="flex-1 rounded-[9px] border border-[#ff7a59]/[.28] bg-[#ff7a59]/[.07] py-2 text-[13px] font-semibold text-[#ff8f76] transition-colors hover:bg-[#ff7a59]/[.16] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b7dff]"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
