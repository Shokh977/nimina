/** `status` is derived, not stored: 'rendered' means the project has a
 * thumbnail (src/components/editor/usePersistence.ts generates one on
 * autosave, once there's something to preview), 'draft' means it doesn't
 * yet. There's no real render-job concept in this app — export renders
 * client-side only (see CLAUDE.md's documented limitation) — so there's no
 * third "rendering" state to represent. */
export type ProjectStatus = 'draft' | 'rendered';

export interface DashboardProject {
  id: string;
  name: string;
  status: ProjectStatus;
  meta: string;
  thumbnailUrl: string | null;
}

export const STATUS_LABEL: Record<ProjectStatus, string> = { draft: 'Draft', rendered: 'Rendered' };
export const STATUS_COLOR: Record<ProjectStatus, string> = { draft: '#9aa1af', rendered: '#5ee6b5' };
