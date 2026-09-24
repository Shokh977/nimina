import type { SaveStatus } from './usePersistence';

const LABEL: Record<SaveStatus, string> = {
  loading: 'Loading…',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

const DOT: Record<SaveStatus, string> = {
  loading: 'bg-neutral-400',
  saving: 'bg-amber-500 animate-pulse',
  saved: 'bg-emerald-500',
  error: 'bg-red-500',
};

export default function SaveStatusBadge({ status }: { status: SaveStatus }) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-neutral-500 dark:text-neutral-400">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
    </span>
  );
}
