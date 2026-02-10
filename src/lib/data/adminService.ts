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

type MedewerkerOrderRow = {
  werknemer_id: number;
  primaire_rol: string | null;
  display_order: number | null;
};

function normalizeRoleGroup(rol: string | null | undefined): string {
  if (!rol) return 'Overig';
  const lower = rol.toLowerCase();
  if (lower === 'stagiair') return 'Stagiair';
  // Account rollen (Account Manager / Head of Account / Account Director, etc.) bij elkaar.
  if (lower.includes('account')) return 'Account';
  return rol;
}

async function reindexMedewerkersDisplayOrder(): Promise<void> {
  // Best-effort: nooit een create/update blokkeren op herindexering.
  try {
    const { data, error } = await secureSelect<MedewerkerOrderRow>('medewerkers', {
      columns: 'werknemer_id,primaire_rol,display_order',
      order: { column: 'display_order', ascending: true },
      limit: 1000,
    });

    if (error) return;
    const rows = data ?? [];
    if (rows.length === 0) return;

    // Groepeer medewerkers
    const groups = new Map<string, MedewerkerOrderRow[]>();
    for (const r of rows) {
      const key = normalizeRoleGroup(r.primaire_rol);
      const arr = groups.get(key) ?? [];
      arr.push(r);
      groups.set(key, arr);
    }

    // Bepaal groepsvolgorde op basis van huidige (min) display_order.
    // - display_order <= 0 of null telt niet mee (wordt als "niet gezet" gezien)
    // - Stagiair altijd als laatste
    const groupMeta = Array.from(groups.entries()).map(([key, members]) => {
      const nonZero = members
        .map((m) => (typeof m.display_order === 'number' && m.display_order > 0 ? m.display_order : null))
        .filter((v): v is number => v !== null);
      const minPos = nonZero.length ? Math.min(...nonZero) : Number.POSITIVE_INFINITY;
      return { key, members, minPos };
    });

    const nonStagiair = groupMeta
      .filter((g) => g.key !== 'Stagiair')
      .sort((a, b) => {
        if (a.minPos !== b.minPos) return a.minPos - b.minPos;
        return a.key.localeCompare(b.key);
      });

    const stagiairGroup = groupMeta.find((g) => g.key === 'Stagiair');
    const orderedGroups = stagiairGroup ? [...nonStagiair, stagiairGroup] : nonStagiair;

    // Sorteer binnen groep: bestaande display_order eerst (maar 0/null achteraan), daarna werknemer_id
    for (const g of orderedGroups) {
      g.members.sort((a, b) => {
        const ao = typeof a.display_order === 'number' && a.display_order > 0 ? a.display_order : Number.POSITIVE_INFINITY;
        const bo = typeof b.display_order === 'number' && b.display_order > 0 ? b.display_order : Number.POSITIVE_INFINITY;
        if (ao !== bo) return ao - bo;
        return a.werknemer_id - b.werknemer_id;
      });
    }

    // Ken nieuwe, opeenvolgende display_order toe
    const desired = new Map<number, number>();
    let next = 1;
    for (const g of orderedGroups) {
      for (const m of g.members) {
        desired.set(m.werknemer_id, next);
        next += 1;
      }
    }

    // Update alleen wat echt verandert (van hoog naar laag is niet nodig; geen unique constraint)
    for (const r of rows) {
      const wanted = desired.get(r.werknemer_id);
      if (!wanted) continue;
      if (r.display_order !== wanted) {
        await secureUpdate('medewerkers', { display_order: wanted }, [
          { column: 'werknemer_id', operator: 'eq', value: r.werknemer_id },
        ]);
      }
    }
  } catch {
    // stil falen
  }
}

export async function getMedewerkers() {
  const { data, error } = await secureSelect<{
    werknemer_id: number;
    naam_werknemer: string;
    microsoft_email: string | null;
    gebruikersnaam: string | null;
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
  
  // Map microsoft_email to email for frontend compatibility
  return (data || []).map(m => ({
    ...m,
    email: m.microsoft_email,
  }));
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

  // display_order
  // - Als je iets invult (>0) respecteren we dat als "hint".
  // - Anders zetten we hem tijdelijk achteraan; daarna herindexeren we zodat:
  //   - rollen gegroepeerd blijven
  //   - nieuwe medewerker onderaan zijn/haar rol-groep komt
  //   - Stagiair altijd helemaal onderaan eindigt
  let displayOrder = typeof medewerker.display_order === 'number' && medewerker.display_order > 0
    ? medewerker.display_order
    : undefined;
  if (!displayOrder) {
    const { data: maxOrder } = await secureSelect<{ display_order: number }>('medewerkers', {
      columns: 'display_order',
      order: { column: 'display_order', ascending: false },
      limit: 1,
    });
    displayOrder = (maxOrder?.[0]?.display_order || 0) + 1;
  }

  // Normalize fields that don't exist on `medewerkers`
  // - `email` is stored in DB as `microsoft_email`
  // - `wachtwoord` is only for `users` table (create-user-account)
  const { wachtwoord, email, ...medewerkerRest } = medewerker;
  const medewerkerData = {
    ...medewerkerRest,
    ...(email !== undefined ? { microsoft_email: email || null } : {}),
  };

  const { data, error } = await secureInsert<{
    werknemer_id: number;
    naam_werknemer: string;
  }>('medewerkers', { ...medewerkerData, werknemer_id: nextId, display_order: displayOrder });

  if (error) throw mapErrorMessage(error);

  const newMedewerker = data?.[0];

  // Herindexeer direct na insert (fix o.a. display_order=0 en zet Stagiairs onderaan)
  await reindexMedewerkersDisplayOrder();

  // Create user account if is_planner is true
  if (medewerker.is_planner && medewerker.gebruikersnaam && newMedewerker) {
    const userResult = await createUserAccount({
      gebruikersnaam: medewerker.gebruikersnaam.toLowerCase().trim(),
      naam: medewerker.naam_werknemer,
      rol: medewerker.primaire_rol || 'Medewerker',
      werknemer_id: newMedewerker.werknemer_id,
      is_planner: true,
      wachtwoord: medewerker.wachtwoord,
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

  // Normalize fields that don't exist on `medewerkers`
  // - `email` is stored in DB as `microsoft_email`
  // - `wachtwoord` is only for `users` table (create-user-account)
  const { wachtwoord, email, ...medewerkerRest } = updates;
  const medewerkerUpdates = {
    ...medewerkerRest,
    ...(email !== undefined ? { microsoft_email: email || null } : {}),
  };

  // Update medewerker first
  const { data, error } = await secureUpdate<{
    werknemer_id: number;
    naam_werknemer: string;
  }>('medewerkers', medewerkerUpdates, [{ column: 'werknemer_id', operator: 'eq', value: werknemer_id }]);

  if (error) throw mapErrorMessage(error);

  // Na elke update herindexeren we de volgorde (rollen bij elkaar + stagiair onderaan)
  await reindexMedewerkersDisplayOrder();

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
        wachtwoord: updates.wachtwoord,
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
    adres: string | null;
    beschikbaarheid: string | null;
    interne_notities: string | null;
    planning_instructies: string | null;
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
    adres?: string;
    beschikbaarheid?: string;
    interne_notities?: string;
    planning_instructies?: string;
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
    adres: string;
    beschikbaarheid: string;
    interne_notities: string;
    planning_instructies: string;
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
