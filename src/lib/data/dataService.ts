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

// ===========================================
// REFERENTIEDATA (uit Supabase)
// ===========================================

/**
 * Haal ALLE beschikbare werknemers op uit Supabase
 * (voor meetings, projecten, dropdowns, etc.)
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

  return data.map((werknemer) => ({
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
  }))
}

/**
 * Haal alleen PLANBARE werknemers op (is_planner = true)
 * Deze toon je in de planning grid
 * Duo teams worden samengevoegd in 1 rij (bv. "Jakko & Niels")
 */
export async function getPlannableEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('medewerkers')
    .select('*')
    .eq('beschikbaar', true)
    .eq('is_planner', true)
    .order('planner_volgorde', { ascending: true, nullsFirst: false })
    .order('naam_werknemer')

  if (error) {
    console.error('Fout bij ophalen planbare werknemers:', error)
    throw new Error(`Fout bij ophalen planbare werknemers: ${error.message}`)
  }

  const employees = data.map((werknemer) => ({
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
  }))

  // Groepeer duo teams
  const processedEmployees: Employee[] = []
  const processedDuoTeams = new Set<string>()

  for (const employee of employees) {
    // Als geen duo team, gewoon toevoegen
    if (!employee.duoTeam) {
      processedEmployees.push(employee)
      continue
    }

    // Als duo team al verwerkt, skip
    if (processedDuoTeams.has(employee.duoTeam)) {
      continue
    }

    // Zoek duo partner
    const partner = employees.find(
      (e) => e.duoTeam === employee.duoTeam && e.id !== employee.id
    )

    if (partner) {
      // Maak samengevoegde entry
      processedEmployees.push({
        ...employee,
        id: `${employee.id},${partner.id}`, // Gecombineerde ID
        name: `${employee.name} & ${partner.name}`, // Gecombineerde naam
      })
      processedDuoTeams.add(employee.duoTeam)
    } else {
      // Geen partner gevonden, toon solo
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

  return data.map((discipline) => ({
    id: discipline.id,
    name: discipline.discipline_naam,
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

  return data.map((klant) => ({
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

  return data.map((taak) => ({
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
    status: taak.plan_status as 'concept' | 'vast',
    isHardLock: taak.is_hard_lock,
    createdBy: '', // Niet in database opgeslagen bij Supabase
  }))
}

/**
 * Maak nieuwe taak aan in Supabase
 */
export async function createTask(task: Omit<Task, 'id'>): Promise<Task> {
  const weekStartISO = task.weekStart.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('taken')
    .insert({
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
    })
    .select()
    .single()

  if (error) {
    console.error('Fout bij aanmaken taak:', error)
    throw new Error(`Fout bij aanmaken taak: ${error.message}`)
  }

  return {
    id: data.id,
    employeeId: data.werknemer_naam,
    projectId: data.project_id || '',
    clientName: data.klant_naam,
    projectNumber: data.project_nummer,
    phaseName: data.fase_naam,
    workType: data.werktype,
    discipline: data.discipline,
    weekStart: new Date(data.week_start),
    dayOfWeek: data.dag_van_week,
    startHour: data.start_uur,
    durationHours: data.duur_uren,
    status: data.plan_status as 'concept' | 'vast',
    isHardLock: data.is_hard_lock,
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
    })
    .eq('id', task.id)
    .select()
    .single()

  if (error) {
    console.error('Fout bij updaten taak:', error)
    throw new Error(`Fout bij updaten taak: ${error.message}`)
  }

  return {
    id: data.id,
    employeeId: data.werknemer_naam,
    projectId: data.project_id || '',
    clientName: data.klant_naam,
    projectNumber: data.project_nummer,
    phaseName: data.fase_naam,
    workType: data.werktype,
    discipline: data.discipline,
    weekStart: new Date(data.week_start),
    dayOfWeek: data.dag_van_week,
    startHour: data.start_uur,
    durationHours: data.duur_uren,
    status: data.plan_status as 'concept' | 'vast',
    isHardLock: data.is_hard_lock,
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

  return data.map((notif) => ({
    id: notif.id,
    type: notif.type as any,
    severity: notif.severity as 'low' | 'medium' | 'high',
    title: notif.titel,
    description: notif.beschrijving || '',
    projectNumber: notif.project_nummer || '',
    clientName: notif.klant_naam || '',
    deadline: undefined, // Niet in database schema
    count: 1,
    isDone: notif.is_done,
  }))
}

// ===========================================
// STATIC DATA (hardcoded, geen DB tabel voor)
// ===========================================

/**
 * Project types - hardcoded
 */
export async function getProjectTypes(): Promise<ProjectType[]> {
  return [
    { id: 'productie', name: 'Productie', description: 'Reguliere productie opdracht' },
    { id: 'guiding_idea', name: 'Guiding Idea', description: 'Strategische guiding idea sessie' },
    { id: 'nieuw_project', name: 'Nieuw Project', description: 'Compleet nieuw project setup' },
    { id: 'algemeen', name: 'Algemeen', description: 'Algemene taken en overleg' },
  ]
}

/**
 * Verlof types - hardcoded
 */
export async function getVerlofTypes(): Promise<VerlofType[]> {
  return [
    { id: 'vakantie', name: 'Vakantie', description: 'Geplande vakantie' },
    { id: 'ziek', name: 'Ziek', description: 'Ziekteverlof' },
    { id: 'training', name: 'Training', description: 'Training of cursus' },
    { id: 'vrije_dag', name: 'Vrije dag', description: 'Snipperdag of compensatieverlof' },
  ]
}

/**
 * Meeting types - hardcoded
 */
export async function getMeetingTypes(): Promise<MeetingType[]> {
  return [
    { id: 'kickoff', name: 'Kickoff', description: 'Project kickoff meeting' },
    { id: 'review', name: 'Review', description: 'Project review meeting' },
    { id: 'presentatie', name: 'Presentatie', description: 'Client presentatie' },
    { id: 'intern', name: 'Intern', description: 'Interne meeting' },
  ]
}

/**
 * Wijziging types - hardcoded
 */
export async function getWijzigingTypes(): Promise<WijzigingType[]> {
  return [
    { id: 'scope', name: 'Scope', description: 'Scope wijziging' },
    { id: 'deadline', name: 'Deadline', description: 'Deadline wijziging' },
    { id: 'team', name: 'Team', description: 'Team samenstelling wijziging' },
    { id: 'budget', name: 'Budget', description: 'Budget wijziging' },
  ]
}

/**
 * Indicatieve periodes - hardcoded
 */
export async function getIndicatievePeriodes(): Promise<IndicatievePeriode[]> {
  return [
    { id: '1_dag', name: '1 dag', description: '1 werkdag', days: 1 },
    { id: '2_3_dagen', name: '2-3 dagen', description: '2 tot 3 werkdagen', days: 2.5 },
    { id: '1_week', name: '1 week', description: '1 werkweek (5 dagen)', days: 5 },
    { id: '2_weken', name: '2 weken', description: '2 werkweken (10 dagen)', days: 10 },
    { id: '1_maand', name: '1 maand', description: '1 maand (20 dagen)', days: 20 },
  ]
}

/**
 * Effort eenheden - hardcoded
 */
export async function getEffortEenheden(): Promise<EffortEenheid[]> {
  return [
    { id: 'uren', name: 'Uren', description: 'Aantal uren' },
    { id: 'dagen', name: 'Dagen', description: 'Aantal dagen' },
    { id: 'weken', name: 'Weken', description: 'Aantal weken' },
  ]
}

/**
 * Prioriteiten - hardcoded
 */
export async function getPrioriteiten(): Promise<Prioriteit[]> {
  return [
    { id: 'laag', name: 'Laag', description: 'Lage prioriteit', color: '#10b981' },
    { id: 'normaal', name: 'Normaal', description: 'Normale prioriteit', color: '#3b82f6' },
    { id: 'hoog', name: 'Hoog', description: 'Hoge prioriteit', color: '#f59e0b' },
    { id: 'urgent', name: 'Urgent', description: 'Urgent', color: '#ef4444' },
  ]
}

// ===========================================
// BULK FETCH - Get all configurable data at once
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
    planningRules: [], // Nog niet geïmplementeerd
  }
}

// ===========================================
// LEGACY FUNCTIONS (voor backwards compatibility)
// ===========================================

export async function updateEmployee(employee: Employee): Promise<Employee> {
  console.log('updateEmployee not yet implemented:', employee)
  return employee
}

export async function updateClient(client: Client): Promise<Client> {
  console.log('updateClient not yet implemented:', client)
  return client
}
