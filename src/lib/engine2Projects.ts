/**
 * Tier 1 item 3: multi-project storage for Engine v2 — localStorage-only
 * for now (explicit instruction: "real project storage comes with the
 * Supabase work"), replacing the single fixed AUTOSAVE_KEY the editor used
 * to always load/save. An index entry (id/name/templateId/updatedAt) is
 * kept separate from each project's own full JSON blob so the gallery can
 * list projects without deserializing every one of them.
 */
import type { SceneProjectV2 } from '@/engine2/types';

const INDEX_KEY = 'engine2-projects-index';
const projectKey = (id: string) => `engine2-project-${id}`;

export interface ProjectIndexEntry {
  id: string;
  name: string;
  templateId: string;
  updatedAt: number;
}

function readIndex(): ProjectIndexEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as ProjectIndexEntry[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: ProjectIndexEntry[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function listProjects(): ProjectIndexEntry[] {
  return readIndex().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProjectById(id: string): SceneProjectV2 | null {
  try {
    const raw = localStorage.getItem(projectKey(id));
    return raw ? (JSON.parse(raw) as SceneProjectV2) : null;
  } catch {
    return null;
  }
}

/** Creates a new index entry + blob and returns its id. Used both for a
 * genuinely new project and — since a duplicate is just "a new id holding
 * a copy of another project's data" — for duplicate(). */
function createEntry(name: string, templateId: string, project: SceneProjectV2): string {
  const id = `p-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  localStorage.setItem(projectKey(id), JSON.stringify(project));
  writeIndex([...readIndex(), { id, name, templateId, updatedAt: Date.now() }]);
  return id;
}

export function createProject(name: string, project: SceneProjectV2): string {
  return createEntry(name, project.templateId, project);
}

/** Saves the current in-editor state for an existing project id — called
 * on the editor's debounced autosave, same cadence the old single-project
 * AUTOSAVE_KEY used. */
export function saveProject(id: string, project: SceneProjectV2): void {
  localStorage.setItem(projectKey(id), JSON.stringify(project));
  const entries = readIndex();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx >= 0) {
    entries[idx] = { ...entries[idx], updatedAt: Date.now() };
    writeIndex(entries);
  }
}

export function renameProject(id: string, name: string): void {
  const entries = readIndex();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return;
  entries[idx] = { ...entries[idx], name, updatedAt: Date.now() };
  writeIndex(entries);
}

export function duplicateProject(id: string): string | null {
  const entries = readIndex();
  const entry = entries.find((e) => e.id === id);
  const project = loadProjectById(id);
  if (!entry || !project) return null;
  return createEntry(`${entry.name} copy`, entry.templateId, project);
}

export function deleteProject(id: string): void {
  localStorage.removeItem(projectKey(id));
  writeIndex(readIndex().filter((e) => e.id !== id));
}
