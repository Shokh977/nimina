import type { SaveStatus } from './usePersistence';

const LABEL: Record<SaveStatus, string> = {
  loading: 'Loading…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

const PILL: Record<SaveStatus, string> = {
  loading: 'bg-white/[.06] text-[#9aa1af]',
  saving: 'bg-[#ffd166]/[.12] text-[#ffd166]',
  saved: 'bg-[#5ee6b5]/[.1] text-[#5ee6b5]',
  error: 'bg-[#ff7a59]/[.12] text-[#ff8f76]',
};

const DOT: Record<SaveStatus, string> = {
  loading: 'bg-[#9aa1af]',
  saving: 'bg-[#ffd166]',
  saved: 'bg-[#5ee6b5] home-pulse-dot',
  error: 'bg-[#ff8f76]',
};

export default function SaveStatusBadge({ status }: { status: SaveStatus }) {
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-[9px] py-1 text-[12.5px] font-medium ${PILL[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
    </span>
  );
}
