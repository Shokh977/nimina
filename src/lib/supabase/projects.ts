import type { SupabaseClient } from '@supabase/supabase-js';

import { createDefaultProject } from '@/engine/project';
import type { Project } from '@/engine/types';
import { logEvent } from '../events';
import { deleteProjectAssets, duplicateProjectAssets } from '@/lib/storage/assets';

export interface ProjectListItem {
  id: string;
  name: string;
  thumbnail_path: string | null;
  updated_at: string;
}

export interface ProjectRow extends ProjectListItem {
  user_id: string;
  data: Project;
  created_at: string;
}

/** Lightweight columns only — the full `data` JSON isn't needed to render
 * the grid. `engine='classic'` filters out Engine v2 rows now that both
 * share this table (see 0012_engine_v2_projects.sql) — without it this
 * would list v2 projects too, whose `data` isn't a classic Project and
 * would break this page's rendering. */
export async function listProjects(supabase: SupabaseClient): Promise<ProjectListItem[]> {
  const { data, error } = await supabase.from('projects').select('id, name, thumbnail_path, updated_at').eq('engine', 'classic').order('updated_at', { ascending: false });
  if (error) throw error;
  return data as ProjectListItem[];
}

export async function getProject(supabase: SupabaseClient, id: string): Promise<ProjectRow | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).eq('engine', 'classic').maybeSingle();
  if (error) throw error;
  return data as ProjectRow | null;
}

export async function createProject(supabase: SupabaseClient, name = 'Untitled promo'): Promise<ProjectRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, data: createDefaultProject() })
    .select('*')
    .single();
  if (error) throw error;
  void logEvent(supabase, 'project_created', { source: 'blank' });
  return data as ProjectRow;
}

export async function createProjectFromTemplate(supabase: SupabaseClient, name: string, data: Project): Promise<ProjectRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data: row, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, data })
    .select('*')
    .single();
  if (error) throw error;
  void logEvent(supabase, 'project_created', { source: 'template' });
  return row as ProjectRow;
}

export async function renameProject(supabase: SupabaseClient, id: string, name: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ name }).eq('id', id);
  if (error) throw error;
}

export async function saveProjectData(supabase: SupabaseClient, id: string, data: Project): Promise<void> {
  const { error } = await supabase.from('projects').update({ data }).eq('id', id);
  if (error) throw error;
}

export async function saveProjectThumbnail(supabase: SupabaseClient, id: string, thumbnailPath: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ thumbnail_path: thumbnailPath }).eq('id', id);
  if (error) throw error;
}

export async function duplicateProject(supabase: SupabaseClient, source: ProjectRow): Promise<ProjectRow> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name: `${source.name} copy`, data: source.data, thumbnail_path: source.thumbnail_path })
    .select('*')
    .single();
  if (error) throw error;
  const copy = data as ProjectRow;

  try {
    await duplicateProjectAssets(source.id, copy.id);
  } catch (err) {
    // A copy without its files would be a broken project — undo it.
    await supabase.from('projects').delete().eq('id', copy.id);
    throw err;
  }
  return copy;
}

export async function deleteProject(supabase: SupabaseClient, id: string): Promise<void> {
  await deleteProjectAssets(id).catch((err) => console.error('[projects] deleting files failed', err));
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}
