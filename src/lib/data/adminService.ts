// ===========================================
// ADMIN SERVICE - CRUD operations for reference data
// Uses secure data-access edge function
// ===========================================

import { secureSelect, secureInsert, secureUpdate, secureDelete, getSessionToken } from './secureDataClient';
import { supabase } from '@/integrations/supabase/client';

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
    discipline_2: string | null;
    discipline_3: string | null;
    werkuren: number | null;
    parttime_dag: string | null;
    duo_team: string | null;
    vaardigheden: string | null;
    notities: string | null;
    beschikbaar: boolean | null;
    is_planner: boolean | null;
    in_planning: boolean | null;
    display_order: number | null;
  }>('medewerkers', {
    order: { column: 'display_order', ascending: true },
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
    gebruikersnaam?: string;
    wachtwoord?: string;
    primaire_rol?: string;
    tweede_rol?: string;
    derde_rol?: string;
    discipline?: string;
    discipline_2?: string;
    discipline_3?: string;
    werkuren?: number;
    parttime_dag?: string;
    duo_team?: string;
    vaardigheden?: string;
    notities?: string;
    beschikbaar?: boolean;
    is_planner?: boolean;
    in_planning?: boolean;
    display_order?: number;
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

  // Auto-calculate display_order if not provided
  let displayOrder = medewerker.display_order;
  if (displayOrder === undefined && medewerker.primaire_rol) {
    // Get max display_order for employees with the same primaire_rol
    const { data: roleData } = await secureSelect<{ display_order: number }>('medewerkers', {
      columns: 'display_order',
      filters: [{ column: 'primaire_rol', operator: 'eq', value: medewerker.primaire_rol }],
      order: { column: 'display_order', ascending: false },
      limit: 1,
    });
    displayOrder = (roleData?.[0]?.display_order || 0) + 1;
  } else if (displayOrder === undefined) {
    // No role specified, put at end
    const { data: allData } = await secureSelect<{ display_order: number }>('medewerkers', {
      columns: 'display_order',
      order: { column: 'display_order', ascending: false },
      limit: 1,
    });
    displayOrder = (allData?.[0]?.display_order || 0) + 1;
  }

  // Remove wachtwoord from medewerker object (it's only for users table, not medewerkers table)
  const { wachtwoord, ...medewerkerData } = medewerker;

  const { data, error } = await secureInsert<{
    werknemer_id: number;
    naam_werknemer: string;
  }>('medewerkers', { ...medewerkerData, werknemer_id: nextId, display_order: displayOrder });

  if (error) throw mapErrorMessage(error);

  const newMedewerker = data?.[0];

  // Create user account if is_planner is true
  if (medewerker.is_planner && medewerker.gebruikersnaam && newMedewerker) {
    const userResult = await createUserAccount({
      gebruikersnaam: medewerker.gebruikersnaam.toLowerCase().trim(),
      naam: medewerker.naam_werknemer,
      rol: medewerker.primaire_rol || 'Medewerker',
      werknemer_id: newMedewerker.werknemer_id,
      is_planner: true,
      wachtwoord: medewerker.wachtwoord || 'selmore2026',
    });

    if (!userResult.success) {
      // User creation failed - set is_planner back to false
      await secureUpdate('medewerkers', { is_planner: false }, [
        { column: 'werknemer_id', operator: 'eq', value: newMedewerker.werknemer_id },
      ]);

      throw new Error(
        `Medewerker aangemaakt, maar gebruikersaccount kon niet worden gemaakt: ${
          userResult.error || 'Onbekende fout'
        }`
      );
    }
  }

  return newMedewerker;
}

// Legacy alias
export const createWerknemer = createMedewerker;

export async function updateMedewerker(
  werknemer_id: number,
  updates: Partial<{
    naam_werknemer: string;
    email: string;
    gebruikersnaam: string;
    wachtwoord: string;
    primaire_rol: string;
    tweede_rol: string;
    derde_rol: string;
    discipline: string;
    discipline_2: string;
    discipline_3: string;
    werkuren: number;
    parttime_dag: string;
    duo_team: string;
    vaardigheden: string;
    notities: string;
    beschikbaar: boolean;
    is_planner: boolean;
    in_planning: boolean;
    display_order: number;
  }>,
  _userId?: string
) {
  // Get existing medewerker to check current is_planner state
  const { data: existing } = await secureSelect<{
    is_planner: boolean | null;
    naam_werknemer: string;
    primaire_rol: string | null;
  }>('medewerkers', {
    filters: [{ column: 'werknemer_id', operator: 'eq', value: werknemer_id }],
    limit: 1,
  });

  const existingMedewerker = existing?.[0];
  const isPlannerActivated = updates.is_planner === true && existingMedewerker?.is_planner !== true;

  // Remove wachtwoord from updates object (it's only for users table, not medewerkers table)
  const { wachtwoord, ...medewerkerUpdates } = updates;

  // Update medewerker first
  const { data, error } = await secureUpdate<{
    werknemer_id: number;
    naam_werknemer: string;
  }>('medewerkers', medewerkerUpdates, [{ column: 'werknemer_id', operator: 'eq', value: werknemer_id }]);

  if (error) throw mapErrorMessage(error);

  // Handle user account creation when is_planner is activated
  if (isPlannerActivated && updates.gebruikersnaam && existingMedewerker) {
    // Check if user account already exists
    const { data: existingUser } = await secureSelect<{
      id: string;
      is_planner: boolean;
    }>('users', {
      filters: [{ column: 'werknemer_id', operator: 'eq', value: werknemer_id }],
      limit: 1,
    });

    if (existingUser?.[0]) {
      // User exists, just reactivate
      await secureUpdate('users', { is_planner: true }, [
        { column: 'id', operator: 'eq', value: existingUser[0].id },
      ]);
    } else {
      // Create new user account
      const userResult = await createUserAccount({
        gebruikersnaam: updates.gebruikersnaam.toLowerCase().trim(),
        naam: existingMedewerker.naam_werknemer,
        rol: existingMedewerker.primaire_rol || 'Medewerker',
        werknemer_id: werknemer_id,
        is_planner: true,
        wachtwoord: updates.wachtwoord || 'selmore2026',
      });

      if (!userResult.success) {
        throw new Error(
          `Medewerker bijgewerkt, maar gebruikersaccount kon niet worden gemaakt: ${
            userResult.error || 'Onbekende fout'
          }`
        );
      }
    }
  }

  // Handle is_planner deactivation
  if (updates.is_planner === false && existingMedewerker?.is_planner === true) {
    // Deactivate user account (don't delete - preserve audit trail)
    await secureUpdate('users', { is_planner: false }, [
      { column: 'werknemer_id', operator: 'eq', value: werknemer_id },
    ]);
  }

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
// USER ACCOUNT CREATION
// ===========================================

export async function createUserAccount(userData: {
  gebruikersnaam: string;
  naam: string;
  rol: string;
  werknemer_id: number;
  is_planner: boolean;
  wachtwoord?: string;
}): Promise<{ success: boolean; error?: string }> {
  const sessionToken = getSessionToken();

  if (!sessionToken) {
    return { success: false, error: 'Geen actieve sessie' };
  }

  try {
    const { data, error } = await supabase.functions.invoke('create-user-account', {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
      body: userData,
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Kon account niet aanmaken',
      };
    }

    if (data?.error) {
      return { success: false, error: data.error };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Onbekende fout bij aanmaken account',
    };
  }
}

// ===========================================
// ROLPROFIELEN CRUD
// ===========================================

export async function getRolprofielen() {
  const { data, error } = await secureSelect<{
    rol_nummer: number;
    rol_naam: string;
    beschrijving_rol: string | null;
    taken_rol: string | null;
    standaard_discipline: string | null;
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
    klantnummer: string;
    naam: string;
    contactpersoon?: string;
    email?: string;
    telefoon?: string;
    adres?: string;
    notities?: string;
  },
  _userId?: string
) {
  const { data, error } = await secureInsert<{
    id: string;
    klantnummer: string;
    naam: string;
  }>('klanten', klant);

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

// ===========================================
// PROJECTTYPES CRUD
// ===========================================

export async function getProjecttypes() {
  const { data, error } = await secureSelect<{
    id: string;
    code: string;
    naam: string;
    omschrijving: string | null;
    is_system: boolean;
  }>('projecttypes', {
    order: { column: 'naam', ascending: true },
  });

  if (error) throw mapErrorMessage(error);
  return data || [];
}

export async function createProjecttype(
  projecttype: {
    code: string;
    naam: string;
    omschrijving?: string;
  },
  _userId?: string
) {
  const { data, error } = await secureInsert<{
    id: string;
    code: string;
    naam: string;
  }>('projecttypes', {
    ...projecttype,
    code: projecttype.code.toLowerCase().replace(/\s+/g, '_'),
    is_system: false,
  });

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

export async function updateProjecttype(
  id: string,
  updates: Partial<{
    naam: string;
    omschrijving: string;
  }>,
  _userId?: string
) {
  const { data, error } = await secureUpdate<{
    id: string;
    naam: string;
  }>('projecttypes', updates, [{ column: 'id', operator: 'eq', value: id }]);

  if (error) throw mapErrorMessage(error);

  return data?.[0];
}

export async function deleteProjecttype(id: string, _userId?: string) {
  const { error } = await secureDelete('projecttypes', [{ column: 'id', operator: 'eq', value: id }]);

  if (error) throw mapErrorMessage(error);
}
