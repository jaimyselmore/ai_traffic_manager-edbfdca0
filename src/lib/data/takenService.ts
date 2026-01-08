// ===========================================
// TAKEN SERVICE - CRUD with audit logging
// ===========================================

import { supabase } from '@/integrations/supabase/client';
import { logCreate, logUpdate, logDelete, checkHardLockPermission } from './auditService';

export interface Taak {
  id: string;
  project_id: string | null;
  project_nummer: string;
  klant_naam: string;
  fase_id: string | null;
  fase_naam: string;
  werknemer_naam: string;
  werktype: string;
  discipline: string;
  week_start: string;
  dag_van_week: number;
  start_uur: number;
  duur_uren: number;
  plan_status: string | null;
  is_hard_lock: boolean | null;
  created_by: string | null;
  locked_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getTaken(weekStart?: Date) {
  let query = supabase
    .from('taken')
    .select('*')
    .order('dag_van_week')
    .order('start_uur');

  if (weekStart) {
    const weekStartStr = weekStart.toISOString().split('T')[0];
    query = query.eq('week_start', weekStartStr);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data || [];
}

export async function createTaak(
  taak: {
    project_id?: string;
    project_nummer: string;
    klant_naam: string;
    fase_id?: string;
    fase_naam: string;
    werknemer_naam: string;
    werktype: string;
    discipline: string;
    week_start: string;
    dag_van_week: number;
    start_uur: number;
    duur_uren: number;
    plan_status?: string;
    is_hard_lock?: boolean;
  },
  userId: string
) {
  const { data, error } = await supabase
    .from('taken')
    .insert({
      ...taak,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Audit log
  await logCreate(userId, 'taken', data.id, data);

  return data;
}

export async function updateTaak(
  id: string,
  updates: Partial<Taak>,
  userId: string,
  currentUserNaam: string
) {
  // First get the existing taak to check hard lock
  const { data: existing, error: fetchError } = await supabase
    .from('taken')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Check hard lock permission
  const lockError = checkHardLockPermission(
    existing.created_by,
    existing.is_hard_lock,
    currentUserNaam
  );
  if (lockError) throw new Error(lockError);

  const { data, error } = await supabase
    .from('taken')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Audit log
  await logUpdate(userId, 'taken', id, existing, data);

  return data;
}

export async function deleteTaak(
  id: string,
  userId: string,
  currentUserNaam: string
) {
  // First get the existing taak to check hard lock
  const { data: existing, error: fetchError } = await supabase
    .from('taken')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  // Check hard lock permission
  const lockError = checkHardLockPermission(
    existing.created_by,
    existing.is_hard_lock,
    currentUserNaam
  );
  if (lockError) throw new Error(lockError);

  const { error } = await supabase
    .from('taken')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Audit log
  await logDelete(userId, 'taken', id, existing);
}
