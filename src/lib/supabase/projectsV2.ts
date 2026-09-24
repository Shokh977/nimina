/**
 * Engine v2's project persistence — mirrors src/lib/supabase/projects.ts's
 * shape exactly (same `projects` table, same Storage bucket via storage.ts,
 * same RLS/plan-limit policy), just typed around SceneProjectV2 and always
 * writing engine:'v2'. Kept as a separate module (not a generic-over-engine
 * version of projects.ts) so classic's own queries stay untouched and this
 * file can't accidentally cross-contaminate a classic project's `data`
 * shape with a v2 one, or vice versa.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import type { SceneProjectV2 } from '@/engine2/types';
import { logEvent } from '../events';
import { deleteProjectAssets, duplicateProjectAssets } from './storage';

export interface ProjectV2ListItem {
  id: string;
  name: string;
  thumbnail_path: string | null;
  updated_at: string;
  engine: 'classic' | 'v2';
}

export interface ProjectV2Row extends ProjectV2ListItem {
  user_id: string;
  data: SceneProjectV2;
  created_at: string;
}

/** Every project for this user regardless of engine — the gallery needs
 * both (v2 projects to open normally, classic ones to list as "Legacy").
 * `data` isn't selected here (unknown shape until `engine` is known, and
 * not needed to render the grid either way). */
export async function listAllProjects(supabase: SupabaseClient): Promise<ProjectV2ListItem[]> {
  const { data, error } = await supabase.from('projects').select('id, name, thumbnail_path, updated_at, engine').order('updated_at', { ascending: false });
  if (error) throw error;
  return data as ProjectV2ListItem[];
}

export async function getProjectV2(supabase: SupabaseClient, id: string): Promise<ProjectV2Row | null> {
  const { data, error } = await supabase.from('projects').select('*').eq('id', id).eq('engine', 'v2').maybeSingle();
  if (error) throw error;
  return data as ProjectV2Row | null;
}

export async function createProjectV2(supabase: SupabaseClient, name: string, data: SceneProjectV2): Promise<ProjectV2Row> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data: row, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name, data, engine: 'v2' })
    .select('*')
    .single();
  if (error) throw error;
  void logEvent(supabase, 'project_created', { source: 'template' });
  return row as ProjectV2Row;
}

export async function renameProjectV2(supabase: SupabaseClient, id: string, name: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ name }).eq('id', id).eq('engine', 'v2');
  if (error) throw error;
}

export async function saveProjectV2Data(supabase: SupabaseClient, id: string, data: SceneProjectV2): Promise<void> {
  const { error } = await supabase.from('projects').update({ data }).eq('id', id).eq('engine', 'v2');
  if (error) throw error;
}

export async function saveProjectV2Thumbnail(supabase: SupabaseClient, id: string, thumbnailPath: string): Promise<void> {
  const { error } = await supabase.from('projects').update({ thumbnail_path: thumbnailPath }).eq('id', id).eq('engine', 'v2');
  if (error) throw error;
}

export async function duplicateProjectV2(supabase: SupabaseClient, source: ProjectV2Row): Promise<ProjectV2Row> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('projects')
    .insert({ user_id: user.id, name: `${source.name} copy`, data: source.data, thumbnail_path: source.thumbnail_path, engine: 'v2' })
    .select('*')
    .single();
  if (error) throw error;
  const copy = data as ProjectV2Row;

  await duplicateProjectAssets(supabase, source.id, copy.id);
  return copy;
}

export async function deleteProjectV2(supabase: SupabaseClient, id: string): Promise<void> {
  await deleteProjectAssets(supabase, id);
  const { error } = await supabase.from('projects').delete().eq('id', id).eq('engine', 'v2');
  if (error) throw error;
}
