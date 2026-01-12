// ===========================================
// VERLOF SERVICE - CRUD using secure data-access
// ===========================================

import { secureSelect, secureInsert, secureUpdate, secureDelete } from './secureDataClient';

// Error codes for client-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  NOT_FOUND: 'Verlofaanvraag niet gevonden',
  DEFAULT: 'Er is een fout opgetreden',
};

function mapErrorMessage(error: Error): Error {
  const message = error.message.toLowerCase();
  if (message.includes('not found') || message.includes('no rows')) {
    return new Error(ERROR_MESSAGES.NOT_FOUND);
  }
  return new Error(ERROR_MESSAGES.DEFAULT);
}

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
  const { data, error } = await secureSelect<VerlofAanvraag>('verlof_aanvragen', {
    order: { column: 'start_datum', ascending: true },
  });

  if (error) throw mapErrorMessage(error);
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
  _userId: string
) {
  // created_by is handled server-side in data-access edge function
  const { data, error } = await secureInsert<VerlofAanvraag>('verlof_aanvragen', verlof);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
  return data?.[0];
}

export async function updateVerlofAanvraag(
  id: string,
  updates: Partial<VerlofAanvraag>,
  _userId: string
) {
  const { data, error } = await secureUpdate<VerlofAanvraag>('verlof_aanvragen', updates, [
    { column: 'id', operator: 'eq', value: id },
  ]);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
  return data?.[0];
}

export async function deleteVerlofAanvraag(id: string, _userId: string) {
  const { error } = await secureDelete('verlof_aanvragen', [
    { column: 'id', operator: 'eq', value: id },
  ]);

  if (error) throw mapErrorMessage(error);

  // Audit logging is handled server-side
}
