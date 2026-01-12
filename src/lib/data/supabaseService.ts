// ===========================================
// SUPABASE DATA SERVICE
// Uses secure data-access edge function
// ===========================================

import { secureSelect } from './secureDataClient';
import type { Employee, Client, Notification, Task } from './types';

// Error handling utility
const DEFAULT_ERROR = 'Er is een fout opgetreden';

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
// EMPLOYEES (users table)
// ===========================================

export async function getEmployeesFromSupabase(): Promise<Employee[]> {
  const { data, error } = await secureSelect<{
    id: string;
    naam: string;
    email: string;
    rol: string;
    is_planner: boolean | null;
    werknemer_id: number | null;
  }>('users', {
    columns: 'id, naam, email, rol, is_planner, werknemer_id',
    order: { column: 'naam', ascending: true },
  });

  if (error) {
    console.error('Error fetching users:', error.message);
    return [];
  }

  return (data || []).map((user) => ({
    id: user.id,
    name: user.naam,
    role: user.rol,
    email: user.email,
    availability: 'available' as const,
    isPlanner: user.is_planner || false,
    werknemerId: user.werknemer_id || undefined,
  }));
}

// ===========================================
// NOTIFICATIONS (notificaties table)
// ===========================================

export async function getNotificationsFromSupabase(): Promise<Notification[]> {
  const { data, error } = await secureSelect<{
    id: string;
    type: string;
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
    clientId: '',
    client: notif.klant_naam || '',
    projectId: notif.project_nummer || undefined,
    project: notif.project_nummer || '',
    workType: notif.type,
    employeeId: notif.voor_werknemer || '',
    employee: notif.voor_werknemer || '',
    deadline: notif.deadline || '',
    severity: notif.severity as Notification['severity'],
    isDone: notif.is_done || false,
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
    fase_naam: string;
    werknemer_naam: string;
    werktype: string;
    week_start: string;
    dag_van_week: number;
    start_uur: number;
    duur_uren: number;
    plan_status: string | null;
  }>('taken', {
    filters: [{ column: 'week_start', operator: 'eq', value: weekStartStr }],
  });

  if (error) {
    console.error('Error fetching taken:', error.message);
    return [];
  }

  return (data || []).map((taak) => {
    const taskDate = new Date(taak.week_start);
    taskDate.setDate(taskDate.getDate() + taak.dag_van_week);

    return {
      id: taak.id,
      title: `${taak.klant_naam} - ${taak.fase_naam}`,
      clientId: taak.project_id || '',
      employeeId: taak.werknemer_naam,
      projectId: taak.project_id || undefined,
      type: taak.werktype,
      date: taskDate.toISOString().split('T')[0],
      startTime: `${taak.start_uur.toString().padStart(2, '0')}:00`,
      endTime: `${(taak.start_uur + taak.duur_uren).toString().padStart(2, '0')}:00`,
      planStatus: (taak.plan_status === 'vast' ? 'vast' : 'concept') as Task['planStatus'],
      faseNaam: taak.fase_naam,
    };
  });
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
  const { data, error } = await secureSelect('meetings', {
    order: { column: 'datum', ascending: true },
  });

  if (error) {
    console.error('Error fetching meetings:', error.message);
    return [];
  }

  return data || [];
}

// ===========================================
// VERLOF (verlof_aanvragen table)
// ===========================================

export async function getVerlofFromSupabase() {
  const { data, error } = await secureSelect('verlof_aanvragen', {
    order: { column: 'start_datum', ascending: true },
  });

  if (error) {
    console.error('Error fetching verlof:', error.message);
    return [];
  }

  return data || [];
}
