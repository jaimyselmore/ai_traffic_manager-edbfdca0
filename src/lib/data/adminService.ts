// ===========================================
// ADMIN SERVICE - CRUD operations for reference data
// Uses secure data-access edge function
// ===========================================

import { secureSelect, secureInsert, secureUpdate, secureDelete } from './secureDataClient';

// Error codes for client-friendly messages
const ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_EMAIL: 'Dit e-mailadres is al in gebruik',
  DUPLICATE_KEY: 'Deze waarde bestaat al',
  INVALID_REFERENCE: 'Ongeldige referentie',
  NOT_FOUND: 'Item niet gevonden',
  DEFAULT: 'Er is een fout opgetreden',
};

function mapErrorMessage(error: Error): Error {
  const message = error.message.toLowerCase();
  if (message.includes('duplicate') && message.includes('email')) {
    return new Error(ERROR_MESSAGES.DUPLICATE_EMAIL);
  }
  if (message.includes('duplicate') || message.includes('unique')) {
    return new Error(ERROR_MESSAGES.DUPLICATE_KEY);
  }
  if (message.includes('foreign key') || message.includes('violates')) {
    return new Error(ERROR_MESSAGES.INVALID_REFERENCE);
  }
  if (message.includes('not found') || message.includes('no rows')) {
    return new Error(ERROR_MESSAGES.NOT_FOUND);
  }
  return new Error(ERROR_MESSAGES.DEFAULT);
}

// ===========================================
// MEDEWERKERS CRUD
// ===========================================

export async function getMedewerkers() {
  const { data, error } = await secureSelect<{
    werknemer_id: number;
    naam_werknemer: string;
    email: string | null;
    primaire_rol: string | null;
    tweede_rol: string | null;
    derde_rol: string | null;
    discipline: string | null;
    werkuren: number | null;
    parttime_dag: string | null;
    duo_team: string | null;
    vaardigheden: string | null;
    notities: string | null;
    beschikbaar: boolean | null;
    is_planner: boolean | null;
    in_planning: boolean | null;
  }>('medewerkers', {
    order: { column: 'werknemer_id', ascending: true },
  });

  if (error) throw mapErrorMessage(error);
  return data || [];
}

// Legacy alias
export const getWerknemers = getMedewerkers;

export async function createMedewerker(
  medewerker: {
    naam_werknemer: string;
    email?: string;
    primaire_rol?: string;
    tweede_rol?: string;
    derde_rol?: string;
    discipline?: string;
    werkuren?: number;
    parttime_dag?: string;
    duo_team?: string;
    vaardigheden?: string;
    notities?: string;
    beschikbaar?: boolean;
    is_planner?: boolean;
    in_planning?: boolean;
  },
  _userId?: string
) {
  // Get next werknemer_id
  const { data: maxData } = await secureSelect<{ werknemer_id: number }>('medewerkers', {
    columns: 'werknemer_id',
    order: { column: 'werknemer_id', ascending: false },
    limit: 1,
  });

  const nextId = (maxData?.[0]?.werknemer_id || 0) + 1;

  const { data, error } = await secureInsert<{
    werknemer_id: number;
    naam_werknemer: string;
  }>('medewerkers', { ...medewerker, werknemer_id: nextId });

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

// Legacy alias
export const createWerknemer = createMedewerker;

export async function updateMedewerker(
  werknemer_id: number,
  updates: Partial<{
    naam_werknemer: string;
    email: string;
    primaire_rol: string;
    tweede_rol: string;
    derde_rol: string;
    discipline: string;
    werkuren: number;
    parttime_dag: string;
    duo_team: string;
    vaardigheden: string;
    notities: string;
    beschikbaar: boolean;
    is_planner: boolean;
    in_planning: boolean;
  }>,
  _userId?: string
) {
  const { data, error } = await secureUpdate<{
    werknemer_id: number;
    naam_werknemer: string;
  }>('medewerkers', updates, [{ column: 'werknemer_id', operator: 'eq', value: werknemer_id }]);

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

// Legacy alias
export const updateWerknemer = updateMedewerker;

export async function deleteMedewerker(werknemer_id: number, _userId?: string) {
  const { error } = await secureDelete('medewerkers', [
    { column: 'werknemer_id', operator: 'eq', value: werknemer_id },
  ]);

  if (error) throw mapErrorMessage(error);
}

// Legacy alias
export const deleteWerknemer = deleteMedewerker;

// ===========================================
// ROLPROFIELEN CRUD
// ===========================================

export async function getRolprofielen() {
  const { data, error } = await secureSelect<{
    rol_nummer: number;
    rol_naam: string;
    beschrijving_rol: string | null;
    taken_rol: string | null;
  }>('rolprofielen', {
    order: { column: 'rol_nummer', ascending: true },
  });

  if (error) throw mapErrorMessage(error);
  return data || [];
}

export async function createRolprofiel(
  rol: {
    rol_naam: string;
    beschrijving_rol?: string;
    taken_rol?: string;
  },
  _userId?: string
) {
  // Get next rol_nummer
  const { data: maxData } = await secureSelect<{ rol_nummer: number }>('rolprofielen', {
    columns: 'rol_nummer',
    order: { column: 'rol_nummer', ascending: false },
    limit: 1,
  });

  const nextNummer = (maxData?.[0]?.rol_nummer || 0) + 1;

  const { data, error } = await secureInsert<{
    rol_nummer: number;
    rol_naam: string;
  }>('rolprofielen', { ...rol, rol_nummer: nextNummer });

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

export async function updateRolprofiel(
  rol_nummer: number,
  updates: Partial<{
    rol_naam: string;
    beschrijving_rol: string;
    taken_rol: string;
  }>,
  _userId?: string
) {
  const { data, error } = await secureUpdate<{
    rol_nummer: number;
    rol_naam: string;
  }>('rolprofielen', updates, [{ column: 'rol_nummer', operator: 'eq', value: rol_nummer }]);

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

export async function deleteRolprofiel(rol_nummer: number, _userId?: string) {
  const { error } = await secureDelete('rolprofielen', [
    { column: 'rol_nummer', operator: 'eq', value: rol_nummer },
  ]);

  if (error) throw mapErrorMessage(error);
}

// ===========================================
// DISCIPLINES CRUD
// ===========================================

export async function getDisciplines() {
  const { data, error } = await secureSelect<{
    id: number;
    discipline_naam: string;
    beschrijving: string | null;
    kleur_hex: string | null;
  }>('disciplines', {
    order: { column: 'id', ascending: true },
  });

  if (error) throw mapErrorMessage(error);
  return data || [];
}

export async function createDiscipline(
  discipline: {
    discipline_naam: string;
    beschrijving?: string;
    kleur_hex?: string;
  },
  _userId?: string
) {
  const { data, error } = await secureInsert<{
    id: number;
    discipline_naam: string;
  }>('disciplines', discipline);

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

export async function updateDiscipline(
  id: number,
  updates: Partial<{
    discipline_naam: string;
    beschrijving: string;
    kleur_hex: string;
  }>,
  _userId?: string
) {
  const { data, error } = await secureUpdate<{
    id: number;
    discipline_naam: string;
  }>('disciplines', updates, [{ column: 'id', operator: 'eq', value: id }]);

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

export async function deleteDiscipline(id: number, _userId?: string) {
  const { error } = await secureDelete('disciplines', [{ column: 'id', operator: 'eq', value: id }]);

  if (error) throw mapErrorMessage(error);
}

// ===========================================
// KLANTEN CRUD
// ===========================================

export async function getKlanten() {
  const { data, error } = await secureSelect<{
    id: string;
    klantnummer: string;
    naam: string;
    contactpersoon: string | null;
    email: string | null;
    telefoon: string | null;
    adres: string | null;
    notities: string | null;
  }>('klanten', {
    order: { column: 'naam', ascending: true },
  });

  if (error) throw mapErrorMessage(error);
  return data || [];
}

export async function createKlant(
  klant: {
    naam: string;
    contactpersoon?: string;
    email?: string;
    telefoon?: string;
    adres?: string;
    notities?: string;
  },
  _userId?: string
) {
  // Generate next klantnummer
  const { data: maxData } = await secureSelect<{ klantnummer: string }>('klanten', {
    columns: 'klantnummer',
    order: { column: 'klantnummer', ascending: false },
    limit: 1,
  });

  let nextNum = 1001;
  if (maxData?.[0]?.klantnummer) {
    const num = parseInt(maxData[0].klantnummer.replace('K', ''), 10);
    if (!isNaN(num)) nextNum = num + 1;
  }

  const { data, error } = await secureInsert<{
    id: string;
    klantnummer: string;
    naam: string;
  }>('klanten', { ...klant, klantnummer: `K${nextNum}` });

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

export async function updateKlant(
  id: string,
  updates: Partial<{
    naam: string;
    contactpersoon: string;
    email: string;
    telefoon: string;
    adres: string;
    notities: string;
  }>,
  _userId?: string
) {
  const { data, error } = await secureUpdate<{
    id: string;
    naam: string;
  }>('klanten', updates, [{ column: 'id', operator: 'eq', value: id }]);

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

export async function deleteKlant(id: string, _userId?: string) {
  const { error } = await secureDelete('klanten', [{ column: 'id', operator: 'eq', value: id }]);

  if (error) throw mapErrorMessage(error);
}
