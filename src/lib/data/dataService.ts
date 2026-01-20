// ===========================================
// DATA SERVICE - Direct Supabase integration
// Alle data komt nu rechtstreeks uit Supabase
// ===========================================

import { supabase } from '../supabase/client'
import type {
  Employee,
  Client,
  ProjectType,
  WorkType,
  VerlofType,
  MeetingType,
  WijzigingType,
  IndicatievePeriode,
  EffortEenheid,
  Prioriteit,
  Notification,
  Task,
  ConfigurableData,
} from './types'

// Supabase row types (inline for better type safety)
interface MedewerkerRow {
  werknemer_id: number
  naam_werknemer: string
  email: string | null
  primaire_rol: string | null
  tweede_rol: string | null
  derde_rol: string | null
  discipline: string | null
  duo_team: string | null
  is_planner: boolean | null
  werkuren: number | null
  parttime_dag: string | null
  beschikbaar: boolean | null
  vaardigheden: string | null
  notities: string | null
  in_planning: boolean | null
  planner_volgorde: number | null
}

interface DisciplineRow {
  id: number
  discipline_naam: string
  beschrijving: string | null
  kleur_hex: string | null
}

interface KlantRow {
  id: string
  klantnummer: string
  naam: string
  contactpersoon: string | null
  email: string | null
  telefoon: string | null
  adres: string | null
  notities: string | null
}

interface TaakRow {
  id: string
  project_id: string | null
  werknemer_naam: string
  klant_naam: string
  project_nummer: string
  fase_naam: string
  werktype: string
  discipline: string
  week_start: string
  dag_van_week: number
  start_uur: number
  duur_uren: number
  plan_status: string | null
  is_hard_lock: boolean | null
}

interface NotificatieRow {
  id: string
  type: string
  titel: string
  beschrijving: string | null
  severity: string
  project_nummer: string | null
  klant_naam: string | null
  is_done: boolean | null
}

// ===========================================
// REFERENTIEDATA (uit Supabase)
// ===========================================

/**
 * Haal ALLE beschikbare werknemers op uit Supabase
 */
export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('medewerkers')
    .select('*')
    .eq('beschikbaar', true)
    .order('planner_volgorde', { ascending: true, nullsFirst: false })
    .order('naam_werknemer')

  if (error) {
    console.error('Fout bij ophalen werknemers:', error)
    throw new Error(`Fout bij ophalen werknemers: ${error.message}`)
  }

  return ((data || []) as MedewerkerRow[]).map((werknemer) => ({
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
  }))
}

/**
 * Haal alleen medewerkers op die IN DE PLANNING staan (in_planning = true)
 */
export async function getPlannableEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('medewerkers')
    .select('*')
    .eq('beschikbaar', true)
    .eq('in_planning', true)
    .order('planner_volgorde', { ascending: true, nullsFirst: false })
    .order('naam_werknemer')

  if (error) {
    console.error('Fout bij ophalen planbare werknemers:', error)
    throw new Error(`Fout bij ophalen planbare werknemers: ${error.message}`)
  }

  const employees = ((data || []) as MedewerkerRow[]).map((werknemer) => ({
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
  }))

  // Groepeer duo teams
  const processedEmployees: Employee[] = []
  const processedDuoTeams = new Set<string>()

  for (const employee of employees) {
    if (!employee.duoTeam) {
      processedEmployees.push(employee)
      continue
    }

    if (processedDuoTeams.has(employee.duoTeam)) {
      continue
    }

    const partner = employees.find(
      (e) => e.duoTeam === employee.duoTeam && e.id !== employee.id
    )

    if (partner) {
      processedEmployees.push({
        ...employee,
        id: `${employee.id},${partner.id}`,
        name: `${employee.name} & ${partner.name}`,
      })
      processedDuoTeams.add(employee.duoTeam)
    } else {
      processedEmployees.push(employee)
    }
  }

  return processedEmployees
}

/**
 * Haal disciplines op uit Supabase
 */
export async function getWorkTypes(): Promise<WorkType[]> {
  const { data, error } = await supabase
    .from('disciplines')
    .select('*')
    .order('discipline_naam')

  if (error) {
    console.error('Fout bij ophalen disciplines:', error)
    throw new Error(`Fout bij ophalen disciplines: ${error.message}`)
  }

  return ((data || []) as DisciplineRow[]).map((discipline) => ({
    id: discipline.id,
    name: discipline.discipline_naam,
    label: discipline.discipline_naam,
    description: discipline.beschrijving || '',
    color: discipline.kleur_hex || '#3b82f6',
  }))
}

/**
 * Haal klanten op uit Supabase
 */
export async function getClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('klanten')
    .select('*')
    .order('naam')

  if (error) {
    console.error('Fout bij ophalen klanten:', error)
    throw new Error(`Fout bij ophalen klanten: ${error.message}`)
  }

  return ((data || []) as KlantRow[]).map((klant) => ({
    id: klant.id,
    code: klant.klantnummer,
    name: klant.naam,
    contactPerson: klant.contactpersoon || '',
    email: klant.email || '',
    phone: klant.telefoon || '',
    address: klant.adres || '',
    notes: klant.notities || '',
  }))
}

// ===========================================
// PLANNING / TAKEN
// ===========================================

/**
 * Haal taken op voor specifieke week uit Supabase
 */
export async function getTasks(weekStart: Date): Promise<Task[]> {
  const weekStartISO = weekStart.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('taken')
    .select('*')
    .eq('week_start', weekStartISO)
    .order('dag_van_week')
    .order('start_uur')

  if (error) {
    console.error('Fout bij ophalen taken:', error)
    throw new Error(`Fout bij ophalen taken: ${error.message}`)
  }

  return ((data || []) as TaakRow[]).map((taak) => ({
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
    status: (taak.plan_status as 'concept' | 'vast') || 'concept',
    isHardLock: taak.is_hard_lock,
    createdBy: '',
  }))
}

/**
 * Maak nieuwe taak aan in Supabase
 */
export async function createTask(task: Omit<Task, 'id'>): Promise<Task> {
  const weekStartISO = task.weekStart.toISOString().split('T')[0]

  const insertData = {
    project_id: task.projectId || null,
    werknemer_naam: task.employeeId,
    klant_naam: task.clientName,
    project_nummer: task.projectNumber,
    fase_naam: task.phaseName,
    werktype: task.workType,
    discipline: task.discipline,
    week_start: weekStartISO,
    dag_van_week: task.dayOfWeek,
    start_uur: task.startHour,
    duur_uren: task.durationHours,
    plan_status: task.status,
    is_hard_lock: task.isHardLock || false,
  }

  const { data, error } = await supabase
    .from('taken')
    .insert(insertData as any)
    .select()
    .single()

  if (error) {
    console.error('Fout bij aanmaken taak:', error)
    throw new Error(`Fout bij aanmaken taak: ${error.message}`)
  }

  const result = data as TaakRow
  if (!result) {
    throw new Error('Geen data teruggekregen bij aanmaken taak')
  }

  return {
    id: result.id,
    employeeId: result.werknemer_naam,
    projectId: result.project_id || '',
    clientName: result.klant_naam,
    projectNumber: result.project_nummer,
    phaseName: result.fase_naam,
    workType: result.werktype,
    discipline: result.discipline,
    weekStart: new Date(result.week_start),
    dayOfWeek: result.dag_van_week,
    startHour: result.start_uur,
    durationHours: result.duur_uren,
    status: (result.plan_status as 'concept' | 'vast') || 'concept',
    isHardLock: result.is_hard_lock,
    createdBy: '',
  }
}

/**
 * Update bestaande taak in Supabase
 */
export async function updateTask(task: Task): Promise<Task> {
  const weekStartISO = task.weekStart.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('taken')
    .update({
      dag_van_week: task.dayOfWeek,
      start_uur: task.startHour,
      duur_uren: task.durationHours,
      plan_status: task.status,
      week_start: weekStartISO,
    } as Record<string, unknown>)
    .eq('id', task.id)
    .select()
    .single()

  if (error) {
    console.error('Fout bij updaten taak:', error)
    throw new Error(`Fout bij updaten taak: ${error.message}`)
  }

  const result = data as TaakRow
  if (!result) {
    throw new Error('Geen data teruggekregen bij updaten taak')
  }

  return {
    id: result.id,
    employeeId: result.werknemer_naam,
    projectId: result.project_id || '',
    clientName: result.klant_naam,
    projectNumber: result.project_nummer,
    phaseName: result.fase_naam,
    workType: result.werktype,
    discipline: result.discipline,
    weekStart: new Date(result.week_start),
    dayOfWeek: result.dag_van_week,
    startHour: result.start_uur,
    durationHours: result.duur_uren,
    status: (result.plan_status as 'concept' | 'vast') || 'concept',
    isHardLock: result.is_hard_lock,
    createdBy: '',
  }
}

/**
 * Verwijder taak uit Supabase
 */
export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase
    .from('taken')
    .delete()
    .eq('id', taskId)

  if (error) {
    console.error('Fout bij verwijderen taak:', error)
    throw new Error(`Fout bij verwijderen taak: ${error.message}`)
  }
}

// ===========================================
// NOTIFICATIES
// ===========================================

/**
 * Haal notificaties op uit Supabase
 */
export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notificaties')
    .select('*')
    .eq('is_done', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Fout bij ophalen notificaties:', error)
    throw new Error(`Fout bij ophalen notificaties: ${error.message}`)
  }

  return ((data || []) as NotificatieRow[]).map((notif) => ({
    id: notif.id,
    type: notif.type as Notification['type'],
    severity: notif.severity as 'low' | 'medium' | 'high',
    title: notif.titel,
    description: notif.beschrijving || '',
    projectNumber: notif.project_nummer || '',
    clientName: notif.klant_naam || '',
    deadline: undefined,
    count: 1,
    isDone: notif.is_done ?? false,
    // Legacy fields for Dashboard compatibility
    client: notif.klant_naam || '',
    project: notif.project_nummer || '',
    workType: notif.type,
    employee: '',
  }))
}

// ===========================================
// STATIC DATA (hardcoded, geen DB tabel voor)
// ===========================================

export async function getProjectTypes(): Promise<ProjectType[]> {
  return [
    { id: 'productie', name: 'Productie', label: 'Productie', description: 'Reguliere productie opdracht' },
    { id: 'guiding_idea', name: 'Guiding Idea', label: 'Guiding Idea', description: 'Strategische guiding idea sessie' },
    { id: 'nieuw_project', name: 'Nieuw Project', label: 'Nieuw Project', description: 'Compleet nieuw project setup' },
    { id: 'algemeen', name: 'Algemeen', label: 'Algemeen', description: 'Algemene taken en overleg' },
  ]
}

export async function getVerlofTypes(): Promise<VerlofType[]> {
  return [
    { id: 'vakantie', name: 'Vakantie', label: 'Vakantie', description: 'Geplande vakantie' },
    { id: 'ziek', name: 'Ziek', label: 'Ziek', description: 'Ziekteverlof' },
    { id: 'training', name: 'Training', label: 'Training', description: 'Training of cursus' },
    { id: 'vrije_dag', name: 'Vrije dag', label: 'Vrije dag', description: 'Snipperdag of compensatieverlof' },
  ]
}

export async function getMeetingTypes(): Promise<MeetingType[]> {
  return [
    { id: 'kickoff', name: 'Kickoff', label: 'Kickoff', description: 'Project kickoff meeting' },
    { id: 'review', name: 'Review', label: 'Review', description: 'Project review meeting' },
    { id: 'presentatie', name: 'Presentatie', label: 'Presentatie', description: 'Client presentatie' },
    { id: 'intern', name: 'Intern', label: 'Intern', description: 'Interne meeting' },
  ]
}

export async function getWijzigingTypes(): Promise<WijzigingType[]> {
  return [
    { id: 'scope', name: 'Scope', label: 'Scope', description: 'Scope wijziging' },
    { id: 'deadline', name: 'Deadline', label: 'Deadline', description: 'Deadline wijziging' },
    { id: 'team', name: 'Team', label: 'Team', description: 'Team samenstelling wijziging' },
    { id: 'budget', name: 'Budget', label: 'Budget', description: 'Budget wijziging' },
  ]
}

export async function getIndicatievePeriodes(): Promise<IndicatievePeriode[]> {
  return [
    { id: '1_dag', name: '1 dag', label: '1 dag', description: '1 werkdag', days: 1 },
    { id: '2_3_dagen', name: '2-3 dagen', label: '2-3 dagen', description: '2 tot 3 werkdagen', days: 2.5 },
    { id: '1_week', name: '1 week', label: '1 week', description: '1 werkweek (5 dagen)', days: 5 },
    { id: '2_weken', name: '2 weken', label: '2 weken', description: '2 werkweken (10 dagen)', days: 10 },
    { id: '1_maand', name: '1 maand', label: '1 maand', description: '1 maand (20 dagen)', days: 20 },
  ]
}

export async function getEffortEenheden(): Promise<EffortEenheid[]> {
  return [
    { id: 'uren', name: 'Uren', label: 'Uren', description: 'Aantal uren' },
    { id: 'dagen', name: 'Dagen', label: 'Dagen', description: 'Aantal dagen' },
    { id: 'weken', name: 'Weken', label: 'Weken', description: 'Aantal weken' },
  ]
}

export async function getPrioriteiten(): Promise<Prioriteit[]> {
  return [
    { id: 'laag', name: 'Laag', label: 'Laag', description: 'Lage prioriteit', color: '#10b981' },
    { id: 'normaal', name: 'Normaal', label: 'Normaal', description: 'Normale prioriteit', color: '#3b82f6' },
    { id: 'hoog', name: 'Hoog', label: 'Hoog', description: 'Hoge prioriteit', color: '#f59e0b' },
    { id: 'urgent', name: 'Urgent', label: 'Urgent', description: 'Urgent', color: '#ef4444' },
  ]
}

// ===========================================
// BULK FETCH
// ===========================================

export async function getAllConfigurableData(): Promise<ConfigurableData> {
  const [
    employees,
    clients,
    projectTypes,
    workTypes,
    verlofTypes,
    meetingTypes,
    wijzigingTypes,
    indicatievePeriodes,
    effortEenheden,
    prioriteiten,
  ] = await Promise.all([
    getEmployees(),
    getClients(),
    getProjectTypes(),
    getWorkTypes(),
    getVerlofTypes(),
    getMeetingTypes(),
    getWijzigingTypes(),
    getIndicatievePeriodes(),
    getEffortEenheden(),
    getPrioriteiten(),
  ])

  return {
    employees,
    clients,
    projectTypes,
    workTypes,
    verlofTypes,
    meetingTypes,
    wijzigingTypes,
    indicatievePeriodes,
    effortEenheden,
    prioriteiten,
    planningRules: [],
  }
}

// ===========================================
// LEGACY FUNCTIONS
// ===========================================

export const fetchEmployees = getEmployees
export const fetchClients = getClients
export const fetchWorkTypes = getWorkTypes
export const fetchTasks = getTasks
