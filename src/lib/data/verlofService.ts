// ===========================================
// VERLOF SERVICE - CRUD with audit logging
// ===========================================

import { supabase } from '@/integrations/supabase/client';
import { logCreate, logUpdate, logDelete } from './auditService';

export interface VerlofAanvraag {
  id: string;
  werknemer_naam: string;
  type: string;
  start_datum: string;
  eind_datum: string;
  reden: string | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getVerlofAanvragen() {
  const { data, error } = await supabase
    .from('verlof_aanvragen')
    .select('*')
    .order('start_datum', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createVerlofAanvraag(
  verlof: {
    werknemer_naam: string;
    type: string;
    start_datum: string;
    eind_datum: string;
    reden?: string;
    status?: string;
  },
  userId: string
) {
  const { data, error } = await supabase
    .from('verlof_aanvragen')
    .insert({
      ...verlof,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Audit log
  await logCreate(userId, 'verlof_aanvragen', data.id, data);

  return data;
}

export async function updateVerlofAanvraag(
  id: string,
  updates: Partial<VerlofAanvraag>,
  userId: string
) {
  // Get existing for audit log
  const { data: existing, error: fetchError } = await supabase
    .from('verlof_aanvragen')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from('verlof_aanvragen')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Audit log
  await logUpdate(userId, 'verlof_aanvragen', id, existing, data);

  return data;
}

export async function deleteVerlofAanvraag(id: string, userId: string) {
  // Get existing for audit log
  const { data: existing, error: fetchError } = await supabase
    .from('verlof_aanvragen')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('verlof_aanvragen')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Audit log
  await logDelete(userId, 'verlof_aanvragen', id, existing);
}
