// ===========================================
// WIJZIGINGSVERZOEKEN SERVICE - CRUD with audit logging
// ===========================================

import { supabase } from '@/integrations/supabase/client';
import { logCreate, logUpdate, logDelete } from './auditService';

export interface Wijzigingsverzoek {
  id: string;
  project_id: string | null;
  type_wijziging: string;
  beschrijving: string;
  impact: string | null;
  nieuwe_deadline: string | null;
  extra_uren: number | null;
  betrokken_mensen: string[] | null;
  status: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export async function getWijzigingsverzoeken() {
  const { data, error } = await supabase
    .from('wijzigingsverzoeken')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createWijzigingsverzoek(
  wijziging: {
    project_id?: string;
    type_wijziging: string;
    beschrijving: string;
    impact?: string;
    nieuwe_deadline?: string;
    extra_uren?: number;
    betrokken_mensen?: string[];
    status?: string;
  },
  userId: string
) {
  const { data, error } = await supabase
    .from('wijzigingsverzoeken')
    .insert({
      ...wijziging,
      created_by: userId,
    })
    .select()
    .single();

  if (error) throw error;

  // Audit log
  await logCreate(userId, 'wijzigingsverzoeken', data.id, data);

  return data;
}

export async function updateWijzigingsverzoek(
  id: string,
  updates: Partial<Wijzigingsverzoek>,
  userId: string
) {
  // Get existing for audit log
  const { data: existing, error: fetchError } = await supabase
    .from('wijzigingsverzoeken')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from('wijzigingsverzoeken')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  // Audit log
  await logUpdate(userId, 'wijzigingsverzoeken', id, existing, data);

  return data;
}

export async function deleteWijzigingsverzoek(id: string, userId: string) {
  // Get existing for audit log
  const { data: existing, error: fetchError } = await supabase
    .from('wijzigingsverzoeken')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('wijzigingsverzoeken')
    .delete()
    .eq('id', id);

  if (error) throw error;

  // Audit log
  await logDelete(userId, 'wijzigingsverzoeken', id, existing);
}
