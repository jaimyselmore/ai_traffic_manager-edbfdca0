// ===========================================
// MEETINGS SERVICE - CRUD using secure data-access
// ===========================================

import { secureSelect, secureInsert, secureUpdate, secureDelete } from './secureDataClient';

// Error codes for client-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  HARD_LOCK: 'Dit item is vergrendeld en kan niet worden aangepast',
  NOT_FOUND: 'Meeting niet gevonden',
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
  const { data, error } = await secureSelect<Meeting>('meetings', {
    order: { column: 'datum', ascending: true },
  });

  if (error) throw mapErrorMessage(error);
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
  _userId: string
) {
  // created_by is handled server-side in data-access edge function
  const { data, error } = await secureInsert<Meeting>('meetings', meeting);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
  return data?.[0];
}

export async function updateMeeting(
  id: string,
  updates: Partial<Meeting>,
  _userId: string,
  _currentUserNaam: string
) {
  // Hard lock check is handled server-side in data-access edge function
  const { data, error } = await secureUpdate<Meeting>('meetings', updates, [
    { column: 'id', operator: 'eq', value: id },
  ]);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
  return data?.[0];
}

export async function deleteMeeting(
  id: string,
  _userId: string,
  _currentUserNaam: string
) {
  // Hard lock check is handled server-side in data-access edge function
  const { error } = await secureDelete('meetings', [{ column: 'id', operator: 'eq', value: id }]);

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
