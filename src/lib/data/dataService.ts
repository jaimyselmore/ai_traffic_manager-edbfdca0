// ===========================================
// DATA SERVICE - Secure Supabase integration via Edge Functions
// All data operations now go through authenticated edge functions
// ===========================================

import { secureSelect, secureInsert, secureUpdate, secureDelete } from './secureDataClient'
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
  display_order: number | null
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
  beschikbaarheid: string | null
  interne_notities: string | null
  planning_instructies: string | null
}

interface ProjectTypeRow {
  id: string
  code: string
  naam: string
  omschrijving: string | null
  is_system: boolean
}

interface ProjectRow {
  id: string
  projectnummer: string
  volgnummer: number
  klant_id: string | null
  titel?: string | null
  omschrijving: string
  projecttype: string
  datum_aanvraag: string
  deadline: string
  status: string | null
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
// REFERENTIEDATA (via secure edge functions)
// ===========================================

/**
 * Haal ALLE beschikbare werknemers op via secure edge function
 */
export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await secureSelect<MedewerkerRow>('medewerkers', {
    columns: '*',
    filters: [{ column: 'beschikbaar', operator: 'eq', value: true }],
    order: { column: 'planner_volgorde', ascending: true },
  })

  if (error) {
    console.error('Fout bij ophalen werknemers:', error)
    throw error
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
  const { data, error } = await secureSelect<MedewerkerRow>('medewerkers', {
    columns: '*',
    filters: [
      { column: 'beschikbaar', operator: 'eq', value: true },
      { column: 'in_planning', operator: 'eq', value: true },
    ],
    order: { column: 'display_order', ascending: true },
  })

  if (error) {
    console.error('Fout bij ophalen planbare werknemers:', error)
    throw error
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

  // Groepeer duo teams (client-side logic)
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
        role: 'Creative Team',
        primaryRole: 'Creative Team',
      })
      processedDuoTeams.add(employee.duoTeam)
    } else {
      processedEmployees.push(employee)
    }
  }

  return processedEmployees
}

/**
 * Haal disciplines op via secure edge function
 */
export async function getWorkTypes(): Promise<WorkType[]> {
  const { data, error } = await secureSelect<DisciplineRow>('disciplines', {
    columns: '*',
    order: { column: 'discipline_naam', ascending: true },
  })

  if (error) {
    console.error('Fout bij ophalen disciplines:', error)
    throw error
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
 * Haal klanten op via secure edge function
 */
export async function getClients(): Promise<Client[]> {
  const { data, error } = await secureSelect<KlantRow>('klanten', {
    columns: '*',
    order: { column: 'naam', ascending: true },
  })

  if (error) {
    console.error('Fout bij ophalen klanten:', error)
    throw error
  }

  return ((data || []) as KlantRow[]).map((klant) => ({
    id: klant.id,
    code: klant.klantnummer,
    name: klant.naam,
    contactPerson: klant.contactpersoon || '',
    email: klant.email || '',
    phone: klant.telefoon || '',
    address: klant.adres || '',
    beschikbaarheid: klant.beschikbaarheid || '',
    interne_notities: klant.interne_notities || '',
    planning_instructies: klant.planning_instructies || '',
  }))
}

/**
 * Maak nieuwe klant aan via secure edge function
 */
export async function createClient(clientData: {
  klantnummer: string
  naam: string
  contactpersoon?: string
  email?: string
  telefoon?: string
  adres?: string
  beschikbaarheid?: string
  interne_notities?: string
  planning_instructies?: string
}): Promise<Client> {
  const insertData = {
    klantnummer: clientData.klantnummer,
    naam: clientData.naam,
    contactpersoon: clientData.contactpersoon || null,
    email: clientData.email || null,
    telefoon: clientData.telefoon || null,
    adres: clientData.adres || null,
    beschikbaarheid: clientData.beschikbaarheid || null,
    interne_notities: clientData.interne_notities || null,
    planning_instructies: clientData.planning_instructies || null,
  }

  const { data, error } = await secureInsert<KlantRow>('klanten', insertData)

  if (error) {
    console.error('Fout bij aanmaken klant:', error)
    throw error
  }

  const result = (data as KlantRow[])?.[0]
  if (!result) {
    throw new Error('Geen data teruggekregen bij aanmaken klant')
  }

  return {
    id: result.id,
    code: result.klantnummer,
    name: result.naam,
    contactPerson: result.contactpersoon || '',
    email: result.email || '',
    phone: result.telefoon || '',
    address: result.adres || '',
    beschikbaarheid: result.beschikbaarheid || '',
    interne_notities: result.interne_notities || '',
    planning_instructies: result.planning_instructies || '',
  }
}

// ===========================================
// PROJECTS (projecten)
// ===========================================

export interface ProjectSummary {
  id: string
  projectnummer: string
  titel?: string | null
  omschrijving: string
  projecttype: string
  klant_id: string | null
  klant_naam?: string
  deadline: string
  status: string | null
}

/**
 * Haal projecten op via secure edge function
 */
export async function getProjects(): Promise<ProjectSummary[]> {
  // First get projects
  const { data: projectData, error: projectError } = await secureSelect<ProjectRow>('projecten', {
    columns: '*',
    order: { column: 'created_at', ascending: false },
  })

  if (projectError) {
    console.error('Fout bij ophalen projecten:', projectError)
    throw projectError
  }

  // Get clients for name lookup
  const { data: clientData } = await secureSelect<KlantRow>('klanten', {
    columns: 'id,naam',
  })

  const clientMap = new Map((clientData || []).map(c => [c.id, c.naam]))

  return ((projectData || []) as ProjectRow[]).map((project) => ({
    id: project.id,
    projectnummer: project.projectnummer,
    titel: null,
    omschrijving: project.omschrijving,
    projecttype: project.projecttype,
    klant_id: project.klant_id,
    klant_naam: project.klant_id ? clientMap.get(project.klant_id) || 'Onbekende klant' : 'Onbekende klant',
    deadline: project.deadline,
    status: project.status,
  }))
}

// ===========================================
// PLANNING / TAKEN
// ===========================================

/**
 * Haal taken op voor specifieke week via secure edge function
 */
export async function getTasks(weekStart: Date): Promise<Task[]> {
  const weekStartISO = weekStart.toISOString().split('T')[0]

  const { data, error } = await secureSelect<TaakRow>('taken', {
    columns: '*',
    filters: [{ column: 'week_start', operator: 'eq', value: weekStartISO }],
    order: { column: 'dag_van_week', ascending: true },
  })

  if (error) {
    console.error('Fout bij ophalen taken:', error)
    throw error
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
 * Maak nieuwe taak aan via secure edge function
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

  const { data, error } = await secureInsert<TaakRow>('taken', insertData)

  if (error) {
    console.error('Fout bij aanmaken taak:', error)
    throw error
  }

  const result = (data as TaakRow[])?.[0]
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
 * Update bestaande taak via secure edge function
 */
export async function updateTask(task: Task): Promise<Task> {
  const weekStartISO = task.weekStart.toISOString().split('T')[0]

  const updateData = {
    dag_van_week: task.dayOfWeek,
    start_uur: task.startHour,
    duur_uren: task.durationHours,
    plan_status: task.status,
    week_start: weekStartISO,
  }

  const { data, error } = await secureUpdate<TaakRow>(
    'taken',
    updateData,
    [{ column: 'id', operator: 'eq', value: task.id }]
  )

  if (error) {
    console.error('Fout bij updaten taak:', error)
    throw error
  }

  const result = (data as TaakRow[])?.[0]
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
 * Verwijder taak via secure edge function
 */
export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await secureDelete('taken', [
    { column: 'id', operator: 'eq', value: taskId }
  ])

  if (error) {
    console.error('Fout bij verwijderen taak:', error)
    throw error
  }
}

// ===========================================
// NOTIFICATIES
// ===========================================

/**
 * Haal notificaties op via secure edge function
 */
export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await secureSelect<NotificatieRow>('notificaties', {
    columns: '*',
    filters: [{ column: 'is_done', operator: 'eq', value: false }],
    order: { column: 'created_at', ascending: false },
  })

  if (error) {
    console.error('Fout bij ophalen notificaties:', error)
    throw error
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
// PROJECTTYPES (via secure edge function)
// ===========================================

export async function getProjectTypes(): Promise<ProjectType[]> {
  const { data, error } = await secureSelect<ProjectTypeRow>('projecttypes', {
    columns: '*',
    order: { column: 'naam', ascending: true },
  })

  if (error) {
    console.error('Fout bij ophalen projecttypes:', error)
    throw error
  }

  return ((data || []) as ProjectTypeRow[]).map((pt) => ({
    id: pt.code,
    name: pt.naam,
    label: pt.naam,
    description: pt.omschrijving || '',
  }))
}

/**
 * Maak nieuw projecttype aan via secure edge function
 */
export async function createProjectType(projectTypeData: {
  code: string
  naam: string
  omschrijving?: string
}): Promise<ProjectType> {
  const insertData = {
    code: projectTypeData.code.toLowerCase().replace(/\s+/g, '_'),
    naam: projectTypeData.naam,
    omschrijving: projectTypeData.omschrijving || null,
    is_system: false,
  }

  const { data, error } = await secureInsert<ProjectTypeRow>('projecttypes', insertData)

  if (error) {
    console.error('Fout bij aanmaken projecttype:', error)
    throw error
  }

  const result = (data as ProjectTypeRow[])?.[0]
  if (!result) {
    throw new Error('Geen data teruggekregen bij aanmaken projecttype')
  }

  return {
    id: result.code,
    name: result.naam,
    label: result.naam,
    description: result.omschrijving || '',
  }
}

// ===========================================
// STATIC DATA (hardcoded, geen DB tabel voor)
// ===========================================

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
