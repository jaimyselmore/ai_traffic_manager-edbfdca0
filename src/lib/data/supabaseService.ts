// ===========================================
// SUPABASE DATA SERVICE
// Fetches real data from Supabase tables
// ===========================================

import { supabase } from '@/integrations/supabase/client';
import type { Employee, Client, Notification, Task } from './types';

// ===========================================
// CLIENTS (klanten table)
// ===========================================

export async function getClientsFromSupabase(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('klanten')
    .select('id, naam, klantnummer, contactpersoon, email, telefoon, adres, notities')
    .order('naam');

  if (error) {
    console.error('Error fetching klanten:', error);
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
  const { data, error } = await supabase
    .from('users')
    .select('id, naam, email, rol, is_planner, werknemer_id')
    .order('naam');

  if (error) {
    console.error('Error fetching users:', error);
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
  const { data, error } = await supabase
    .from('notificaties')
    .select('*')
    .eq('is_done', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching notificaties:', error);
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

  const { data, error } = await supabase
    .from('taken')
    .select('*')
    .eq('week_start', weekStartStr);

  if (error) {
    console.error('Error fetching taken:', error);
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
  const { data, error } = await supabase
    .from('projecten')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projecten:', error);
    return [];
  }

  return data || [];
}

// ===========================================
// MEETINGS (meetings table)
// ===========================================

export async function getMeetingsFromSupabase() {
  const { data, error } = await supabase
    .from('meetings')
    .select('*')
    .order('datum', { ascending: true });

  if (error) {
    console.error('Error fetching meetings:', error);
    return [];
  }

  return data || [];
}

// ===========================================
// VERLOF (verlof_aanvragen table)
// ===========================================

export async function getVerlofFromSupabase() {
  const { data, error } = await supabase
    .from('verlof_aanvragen')
    .select('*')
    .order('start_datum', { ascending: true });

  if (error) {
    console.error('Error fetching verlof:', error);
    return [];
  }

  return data || [];
}
