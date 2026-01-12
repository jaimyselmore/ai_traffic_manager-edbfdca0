// ===========================================
// WIJZIGINGSVERZOEKEN SERVICE - CRUD using secure data-access
// ===========================================

import { secureSelect, secureInsert, secureUpdate, secureDelete } from './secureDataClient';

// Error codes for client-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'Wijzigingsverzoek niet gevonden',
  DEFAULT: 'Er is een fout opgetreden',
};

function mapErrorMessage(error: Error): Error {
  const message = error.message.toLowerCase();
  if (message.includes('not found') || message.includes('no rows')) {
    return new Error(ERROR_MESSAGES.NOT_FOUND);
  }
  return new Error(ERROR_MESSAGES.DEFAULT);
}

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
  const { data, error } = await secureSelect<Wijzigingsverzoek>('wijzigingsverzoeken', {
    order: { column: 'created_at', ascending: false },
  });

  if (error) throw mapErrorMessage(error);
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
  _userId: string
) {
  // created_by is handled server-side in data-access edge function
  const { data, error } = await secureInsert<Wijzigingsverzoek>('wijzigingsverzoeken', wijziging);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
  return data?.[0];
}

export async function updateWijzigingsverzoek(
  id: string,
  updates: Partial<Wijzigingsverzoek>,
  _userId: string
) {
  const { data, error } = await secureUpdate<Wijzigingsverzoek>('wijzigingsverzoeken', updates, [
    { column: 'id', operator: 'eq', value: id },
  ]);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
  return data?.[0];
}

export async function deleteWijzigingsverzoek(id: string, _userId: string) {
  const { error } = await secureDelete('wijzigingsverzoeken', [
    { column: 'id', operator: 'eq', value: id },
  ]);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
}
