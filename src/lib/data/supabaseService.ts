// ===========================================
// SUPABASE DATA SERVICE
// Uses secure data-access edge function
// ===========================================

import { secureSelect } from './secureDataClient';
import type { Employee, Client, Notification, Task } from './types';

// ===========================================
// CLIENTS (klanten table)
// ===========================================

export async function getClientsFromSupabase(): Promise<Client[]> {
  const { data, error } = await secureSelect<{
    id: string;
    naam: string;
    klantnummer: string;
    contactpersoon: string | null;
    email: string | null;
    telefoon: string | null;
    adres: string | null;
    notities: string | null;
  }>('klanten', {
    columns: 'id, naam, klantnummer, contactpersoon, email, telefoon, adres, notities',
    order: { column: 'naam', ascending: true },
  });

  if (error) {
    console.error('Error fetching klanten:', error.message);
    return [];
  }

  return (data || []).map((klant) => ({
    id: klant.id,
    name: klant.naam,
    klantnummer: klant.klantnummer,
    contactPerson: klant.contactpersoon || undefined,
    email: klant.email || undefined,
    telefoon: klant.telefoon || undefined,
    adres: klant.adres || undefined,
    notities: klant.notities || undefined,
  }));
}

// ===========================================
// EMPLOYEES (medewerkers table)
// ===========================================

export async function getEmployeesFromSupabase(): Promise<Employee[]> {
  const { data, error } = await secureSelect<{
    werknemer_id: number;
    naam_werknemer: string;
    email: string | null;
    primaire_rol: string | null;
    tweede_rol: string | null;
    derde_rol: string | null;
    discipline: string | null;
    duo_team: string | null;
    is_planner: boolean | null;
    werkuren: number | null;
    parttime_dag: string | null;
    beschikbaar: boolean | null;
    vaardigheden: string | null;
    notities: string | null;
  }>('medewerkers', {
    columns: '*',
    order: { column: 'naam_werknemer', ascending: true },
  });

  if (error) {
    console.error('Error fetching medewerkers:', error.message);
    return [];
  }

  return (data || []).map((werknemer) => ({
    id: werknemer.werknemer_id.toString(),
    name: werknemer.naam_werknemer,
    email: werknemer.email || '',
    primaryRole: werknemer.primaire_rol || 'Onbekend',
    secondaryRole: werknemer.tweede_rol || undefined,
    tertiaryRole: werknemer.derde_rol || undefined,
    discipline: werknemer.discipline || 'Algemeen',
    duoTeam: werknemer.duo_team || undefined,
    isPlanner: werknemer.is_planner,
    workHours: werknemer.werkuren,
    partTimeDay: werknemer.parttime_dag || undefined,
    available: werknemer.beschikbaar,
    skills: werknemer.vaardigheden || '',
    notes: werknemer.notities || '',
    role: werknemer.primaire_rol || 'Onbekend',
  }));
}

// ===========================================
// NOTIFICATIONS (notificaties table)
// ===========================================

export async function getNotificationsFromSupabase(): Promise<Notification[]> {
  const { data, error } = await secureSelect<{
    id: string;
    type: string;
    titel: string;
    beschrijving: string | null;
    klant_naam: string | null;
    project_nummer: string | null;
    voor_werknemer: string | null;
    deadline: string | null;
    severity: string;
    is_done: boolean | null;
  }>('notificaties', {
    filters: [{ column: 'is_done', operator: 'eq', value: false }],
    order: { column: 'created_at', ascending: false },
  });

  if (error) {
    console.error('Error fetching notificaties:', error.message);
    return [];
  }

  return (data || []).map((notif) => ({
    id: notif.id,
    type: notif.type as Notification['type'],
    severity: notif.severity as Notification['severity'],
    title: notif.titel,
    description: notif.beschrijving || '',
    projectNumber: notif.project_nummer || '',
    clientName: notif.klant_naam || '',
    deadline: notif.deadline || undefined,
    count: 1,
    isDone: notif.is_done || false,
    // Legacy fields
    clientId: '',
    client: notif.klant_naam || '',
    projectId: notif.project_nummer || undefined,
    project: notif.project_nummer || '',
    workType: notif.type,
    employeeId: notif.voor_werknemer || '',
    employee: notif.voor_werknemer || '',
  }));
}

// ===========================================
// TASKS (taken table)
// ===========================================

export async function getTasksFromSupabase(weekStart: Date): Promise<Task[]> {
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const { data, error } = await secureSelect<{
    id: string;
    project_id: string | null;
    klant_naam: string;
    project_nummer: string;
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
  }>('taken', {
    filters: [{ column: 'week_start', operator: 'eq', value: weekStartStr }],
  });

  if (error) {
    console.error('Error fetching taken:', error.message);
    return [];
  }

  return (data || []).map((taak) => ({
    id: taak.id,
    employeeId: taak.werknemer_naam,
    projectId: taak.project_id || '',
    clientName: taak.klant_naam,
    projectNumber: taak.project_nummer,
    phaseName: taak.fase_naam,
    workType: taak.werktype,
    discipline: taak.discipline,
    weekStart: new Date(taak.week_start),
    dayOfWeek: taak.dag_van_week,
    startHour: taak.start_uur,
    durationHours: taak.duur_uren,
    status: (taak.plan_status === 'vast' ? 'vast' : 'concept') as Task['status'],
    isHardLock: taak.is_hard_lock,
    createdBy: '',
  }));
}

// ===========================================
// PROJECTS (projecten table)
// ===========================================

export async function getProjectsFromSupabase() {
  const { data, error } = await secureSelect('projecten', {
    order: { column: 'created_at', ascending: false },
  });

  if (error) {
    console.error('Error fetching projecten:', error.message);
    return [];
  }

  return data || [];
}

// ===========================================
// MEETINGS (meetings table)
// ===========================================

export async function getMeetingsFromSupabase() {
  const { data, error } = await secureSelect('meetings & presentaties', {
    order: { column: 'datum', ascending: true },
  });

  if (error) {
    console.error('Error fetching meetings:', error.message);
    return [];
  }

  return data || [];
}

// ===========================================
// VERLOF (beschikbaarheid_medewerkers table)
// ===========================================

export async function getVerlofFromSupabase() {
  const { data, error } = await secureSelect('beschikbaarheid_medewerkers', {
    order: { column: 'start_datum', ascending: true },
  });

  if (error) {
    console.error('Error fetching verlof:', error.message);
    return [];
  }

  return data || [];
}
