// ===========================================
// MEETINGS SERVICE - CRUD with audit logging & hard lock support
// ===========================================

import { supabase } from '@/integrations/supabase/client';
import { logCreate, logUpdate, logDelete, checkHardLockPermission } from './auditService';

export interface Meeting {
  id: string;
  project_id: string | null;
  datum: string;
  start_tijd: string;
  eind_tijd: string;
  onderwerp: string;
  type: string;
  locatie: string | null;
  deelnemers: string[] | null;
  is_hard_lock: boolean | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getMeetings() {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('datum', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createMeeting(
  meeting: {
    project_id?: string;
    datum: string;
    start_tijd: string;
    eind_tijd: string;
    onderwerp: string;
    type: string;
    locatie?: string;
    deelnemers?: string[];
    is_hard_lock?: boolean;
    status?: string;
  },
  userId: string
) {
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      ...meeting,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Audit log
  await logCreate(userId, 'meetings', data.id, data);

  return data;
}

export async function updateMeeting(
  id: string,
  updates: Partial<Meeting>,
  userId: string,
  currentUserNaam: string
) {
  // First get the existing meeting to check hard lock
  const { data: existing, error: fetchError } = await supabase
    .from('meetings')
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
    .from('meetings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Audit log
  await logUpdate(userId, 'meetings', id, existing, data);

  return data;
}

export async function deleteMeeting(
  id: string,
  userId: string,
  currentUserNaam: string
) {
  // First get the existing meeting to check hard lock
  const { data: existing, error: fetchError } = await supabase
    .from('meetings')
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
    .from('meetings')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Audit log
  await logDelete(userId, 'meetings', id, existing);
}
