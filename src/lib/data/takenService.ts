// ===========================================
// TAKEN SERVICE - CRUD using secure data-access
// ===========================================

import { secureSelect, secureInsert, secureUpdate, secureDelete } from './secureDataClient';

// Error codes for client-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  HARD_LOCK: 'Dit item is vergrendeld en kan niet worden aangepast',
  NOT_FOUND: 'Taak niet gevonden',
  DEFAULT: 'Er is een fout opgetreden',
};

function mapErrorMessage(error: Error): Error {
  const message = error.message.toLowerCase();
  if (message.includes('hard lock') || message.includes('alleen')) {
    return new Error(error.message); // Keep the specific lock message
  }
  if (message.includes('not found') || message.includes('no rows')) {
    return new Error(ERROR_MESSAGES.NOT_FOUND);
  }
  return new Error(ERROR_MESSAGES.DEFAULT);
}

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
  const filters = weekStart
    ? [{ column: 'week_start', operator: 'eq' as const, value: weekStart.toISOString().split('T')[0] }]
    : undefined;

  const { data, error } = await secureSelect<Taak>('taken', {
    filters,
    order: { column: 'dag_van_week', ascending: true },
  });

  if (error) throw mapErrorMessage(error);
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
  _userId: string
) {
  // created_by is handled server-side in data-access edge function
  const { data, error } = await secureInsert<Taak>('taken', taak);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
  return data?.[0];
}

export async function updateTaak(
  id: string,
  updates: Partial<Taak>,
  _userId: string,
  _currentUserNaam: string
) {
  // Hard lock check is handled server-side in data-access edge function
  const { data, error } = await secureUpdate<Taak>('taken', updates, [
    { column: 'id', operator: 'eq', value: id },
  ]);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
  return data?.[0];
}

export async function deleteTaak(
  id: string,
  _userId: string,
  _currentUserNaam: string
) {
  // Hard lock check is handled server-side in data-access edge function
  const { error } = await secureDelete('taken', [{ column: 'id', operator: 'eq', value: id }]);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
}

// Re-export checkHardLockPermission for backward compatibility (client-side display only)
export function checkHardLockPermission(
  itemCreatedBy: string | null | undefined,
  itemIsHardLock: boolean | null | undefined,
  currentUserNaam: string
): string | null {
  if (!itemIsHardLock) return null;
  if (!itemCreatedBy) return null;

  if (itemCreatedBy !== currentUserNaam) {
    return `Alleen ${itemCreatedBy} kan dit aanpassen (hard lock)`;
  }

  return null;
}
