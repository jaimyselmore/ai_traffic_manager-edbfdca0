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
}

interface KlantRow {
  id: string
  klantnummer: string
  naam: string
  reistijd_minuten: number | null
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
    reistijd_minuten: klant.reistijd_minuten,
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
  reistijd_minuten?: number | null
  interne_notities?: string
  planning_instructies?: string
}): Promise<Client> {
  const insertData = {
    klantnummer: clientData.klantnummer,
    naam: clientData.naam,
    reistijd_minuten: clientData.reistijd_minuten ?? null,
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
    reistijd_minuten: result.reistijd_minuten,
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
// DASHBOARD STATISTIEKEN
// ===========================================

export interface DashboardStats {
  upcomingDeadlines: number
  activeProjects: number
  pendingReviews: number
  pendingChanges: number
}

export interface UpcomingDeadline {
  id: string
  projectnummer: string
  klant_naam: string
  omschrijving: string
  deadline: string
  daysUntil: number
  severity: 'low' | 'medium' | 'high'
}

export interface ActiveProject {
  id: string
  projectnummer: string
  klant_naam: string
  omschrijving: string
  deadline: string
  status: string
  takenCount: number
}

export interface AfgerondProject {
  id: string
  projectnummer: string
  klant_naam: string
  omschrijving: string
  deadline: string
  afgerond_op: string
}

export interface InterneReview {
  id: string
  project_id: string | null
  projectnummer: string
  klant_naam: string
  reviewer_naam: string
  titel: string
  beschrijving: string
  status: 'open' | 'in_review' | 'goedgekeurd' | 'afgewezen'
  prioriteit: 'laag' | 'normaal' | 'hoog' | 'urgent'
  deadline: string | null
}

export interface Wijzigingsverzoek {
  id: string
  project_id: string | null
  projectnummer: string
  klant_naam: string
  aanvrager_naam: string
  type: 'scope' | 'deadline' | 'team' | 'budget' | 'anders'
  status: 'ingediend' | 'in_behandeling' | 'goedgekeurd' | 'afgewezen'
  prioriteit: 'laag' | 'normaal' | 'hoog' | 'urgent'
  titel: string
  huidige_situatie: string
  gewenste_situatie: string
}

/**
 * Haal aankomende deadlines op (projecten met deadline binnen 14 dagen)
 */
export async function getUpcomingDeadlines(): Promise<UpcomingDeadline[]> {
  const today = new Date()
  const todayISO = today.toISOString().split('T')[0]

  // Haal projecten op met deadline in de toekomst
  const { data: projectData, error: projectError } = await secureSelect<ProjectRow>('projecten', {
    columns: '*',
    filters: [
      { column: 'deadline', operator: 'gte', value: todayISO },
    ],
    order: { column: 'deadline', ascending: true },
  })

  if (projectError) {
    console.error('Fout bij ophalen deadlines:', projectError)
    return []
  }

  // Get clients for name lookup
  const { data: clientData } = await secureSelect<KlantRow>('klanten', {
    columns: 'id,naam',
  })
  const clientMap = new Map((clientData || []).map(c => [c.id, c.naam]))

  const results: UpcomingDeadline[] = []

  for (const project of (projectData || [])) {
    const deadlineDate = new Date(project.deadline + 'T00:00:00')
    const diffTime = deadlineDate.getTime() - today.getTime()
    const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Alleen projecten binnen 14 dagen
    if (daysUntil <= 14) {
      results.push({
        id: project.id,
        projectnummer: project.projectnummer,
        klant_naam: project.klant_id ? clientMap.get(project.klant_id) || 'Onbekende klant' : 'Onbekende klant',
        omschrijving: project.omschrijving,
        deadline: project.deadline,
        daysUntil,
        severity: daysUntil <= 2 ? 'high' : daysUntil <= 7 ? 'medium' : 'low',
      })
    }
  }

  return results
}

/**
 * Haal actieve projecten op - projecten die daadwerkelijke taken in de planner hebben
 * Een project is "actief" als er minstens 1 taak in de taken-tabel bestaat
 */
export async function getActiveProjects(): Promise<ActiveProject[]> {
  // Eerst alle taken ophalen om te zien welke projecten daadwerkelijk gepland zijn
  const { data: takenData, error: takenError } = await secureSelect<TaakRow>('taken', {
    columns: 'project_id,project_nummer,klant_naam,werktype',
  })

  if (takenError) {
    console.error('Fout bij ophalen taken voor actieve projecten:', takenError)
    return []
  }

  // Filter out non-project tasks (verlof, ziek, meetings without project)
  const nonProjectTypes = ['verlof', 'ziek']
  const projectTaken = (takenData || []).filter(taak =>
    !nonProjectTypes.includes(taak.werktype) && taak.project_id !== null
  )

  // Groepeer taken per project_nummer om te tellen
  const projectTakenMap = new Map<string, { count: number, klant_naam: string, project_id: string | null }>()
  for (const taak of projectTaken) {
    const existing = projectTakenMap.get(taak.project_nummer)
    if (existing) {
      existing.count++
    } else {
      projectTakenMap.set(taak.project_nummer, {
        count: 1,
        klant_naam: taak.klant_naam,
        project_id: taak.project_id,
      })
    }
  }

  // Als er geen taken zijn, return lege array
  if (projectTakenMap.size === 0) {
    return []
  }

  // Haal project details op voor de projecten die taken hebben
  const projectIds = Array.from(projectTakenMap.values())
    .map(p => p.project_id)
    .filter((id): id is string => id !== null)

  let projectDetails = new Map<string, ProjectRow>()

  if (projectIds.length > 0) {
    const { data: projectData } = await secureSelect<ProjectRow>('projecten', {
      columns: '*',
      filters: [
        { column: 'status', operator: 'neq', value: 'afgerond' },
      ],
    })

    for (const project of (projectData || [])) {
      projectDetails.set(project.id, project)
    }
  }

  // Combineer de data
  const results: ActiveProject[] = []

  for (const [projectnummer, taakInfo] of projectTakenMap) {
    // Check of project niet afgerond is
    const projectDetail = taakInfo.project_id ? projectDetails.get(taakInfo.project_id) : null

    // Skip afgeronde projecten
    if (projectDetail?.status === 'afgerond') continue

    results.push({
      id: taakInfo.project_id || projectnummer,
      projectnummer,
      klant_naam: taakInfo.klant_naam,
      omschrijving: projectDetail?.omschrijving || '',
      deadline: projectDetail?.deadline || '',
      status: projectDetail?.status || 'actief',
      takenCount: taakInfo.count,
    })
  }

  // Sorteer op deadline
  return results.sort((a, b) => {
    if (!a.deadline) return 1
    if (!b.deadline) return -1
    return a.deadline.localeCompare(b.deadline)
  })
}

/**
 * Haal dashboard statistieken op (counts)
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [upcomingDeadlines, activeProjects, pendingReviews, pendingChanges] = await Promise.all([
    getUpcomingDeadlines(),
    getActiveProjects(),
    getInterneReviewsCount(),
    getWijzigingsverzoekenCount(),
  ])

  return {
    upcomingDeadlines: upcomingDeadlines.length,
    activeProjects: activeProjects.length,
    pendingReviews,
    pendingChanges,
  }
}

// ===========================================
// INTERNE REVIEWS
// ===========================================

interface InterneReviewRow {
  id: string
  project_id: string | null
  reviewer_id: number | null
  aanvrager_id: number | null
  status: string
  prioriteit: string
  titel: string
  beschrijving: string | null
  deadline: string | null
  opmerkingen: string | null
  created_at: string
}

/**
 * Haal openstaande interne reviews count op
 */
export async function getInterneReviewsCount(): Promise<number> {
  const { data, error } = await secureSelect<InterneReviewRow>('interne_reviews', {
    columns: 'id',
    filters: [
      { column: 'status', operator: 'in', value: '(open,in_review)' },
    ],
  })

  if (error) {
    // Tabel bestaat mogelijk nog niet
    console.log('Interne reviews tabel nog niet beschikbaar')
    return 0
  }

  return (data || []).length
}

/**
 * Haal alle openstaande interne reviews op
 */
export async function getInterneReviews(): Promise<InterneReview[]> {
  const { data, error } = await secureSelect<InterneReviewRow>('interne_reviews', {
    columns: '*',
    filters: [
      { column: 'status', operator: 'in', value: '(open,in_review)' },
    ],
    order: { column: 'created_at', ascending: false },
  })

  if (error) {
    console.log('Interne reviews tabel nog niet beschikbaar')
    return []
  }

  // Get projects en medewerkers for name lookup
  const [{ data: projectData }, { data: medewerkerData }] = await Promise.all([
    secureSelect<ProjectRow>('projecten', { columns: 'id,projectnummer,klant_id' }),
    secureSelect<MedewerkerRow>('medewerkers', { columns: 'werknemer_id,naam_werknemer' }),
  ])

  const { data: clientData } = await secureSelect<KlantRow>('klanten', { columns: 'id,naam' })

  const projectMap = new Map((projectData || []).map(p => [p.id, p]))
  const medewerkerMap = new Map((medewerkerData || []).map(m => [m.werknemer_id, m.naam_werknemer]))
  const clientMap = new Map((clientData || []).map(c => [c.id, c.naam]))

  return ((data || []) as InterneReviewRow[]).map(review => {
    const project = review.project_id ? projectMap.get(review.project_id) : null
    const klantNaam = project?.klant_id ? clientMap.get(project.klant_id) || '' : ''

    return {
      id: review.id,
      project_id: review.project_id,
      projectnummer: project?.projectnummer || '',
      klant_naam: klantNaam,
      reviewer_naam: review.reviewer_id ? medewerkerMap.get(review.reviewer_id) || '' : '',
      titel: review.titel,
      beschrijving: review.beschrijving || '',
      status: review.status as InterneReview['status'],
      prioriteit: review.prioriteit as InterneReview['prioriteit'],
      deadline: review.deadline,
    }
  })
}

// ===========================================
// WIJZIGINGSVERZOEKEN
// ===========================================

interface WijzigingsverzoekRow {
  id: string
  project_id: string | null
  aanvrager_id: number | null
  type: string
  status: string
  prioriteit: string
  titel: string
  huidige_situatie: string | null
  gewenste_situatie: string | null
  reden: string | null
  impact: string | null
  deadline: string | null
  created_at: string
}

/**
 * Haal openstaande wijzigingsverzoeken count op
 */
export async function getWijzigingsverzoekenCount(): Promise<number> {
  const { data, error } = await secureSelect<WijzigingsverzoekRow>('wijzigingsverzoeken', {
    columns: 'id',
    filters: [
      { column: 'status', operator: 'in', value: '(ingediend,in_behandeling)' },
    ],
  })

  if (error) {
    // Tabel bestaat mogelijk nog niet
    console.log('Wijzigingsverzoeken tabel nog niet beschikbaar')
    return 0
  }

  return (data || []).length
}

/**
 * Haal alle openstaande wijzigingsverzoeken op
 */
export async function getWijzigingsverzoeken(): Promise<Wijzigingsverzoek[]> {
  const { data, error } = await secureSelect<WijzigingsverzoekRow>('wijzigingsverzoeken', {
    columns: '*',
    filters: [
      { column: 'status', operator: 'in', value: '(ingediend,in_behandeling)' },
    ],
    order: { column: 'created_at', ascending: false },
  })

  if (error) {
    console.log('Wijzigingsverzoeken tabel nog niet beschikbaar')
    return []
  }

  // Get projects en medewerkers for name lookup
  const [{ data: projectData }, { data: medewerkerData }] = await Promise.all([
    secureSelect<ProjectRow>('projecten', { columns: 'id,projectnummer,klant_id' }),
    secureSelect<MedewerkerRow>('medewerkers', { columns: 'werknemer_id,naam_werknemer' }),
  ])

  const { data: clientData } = await secureSelect<KlantRow>('klanten', { columns: 'id,naam' })

  const projectMap = new Map((projectData || []).map(p => [p.id, p]))
  const medewerkerMap = new Map((medewerkerData || []).map(m => [m.werknemer_id, m.naam_werknemer]))
  const clientMap = new Map((clientData || []).map(c => [c.id, c.naam]))

  return ((data || []) as WijzigingsverzoekRow[]).map(verzoek => {
    const project = verzoek.project_id ? projectMap.get(verzoek.project_id) : null
    const klantNaam = project?.klant_id ? clientMap.get(project.klant_id) || '' : ''

    return {
      id: verzoek.id,
      project_id: verzoek.project_id,
      projectnummer: project?.projectnummer || '',
      klant_naam: klantNaam,
      aanvrager_naam: verzoek.aanvrager_id ? medewerkerMap.get(verzoek.aanvrager_id) || '' : '',
      type: verzoek.type as Wijzigingsverzoek['type'],
      status: verzoek.status as Wijzigingsverzoek['status'],
      prioriteit: verzoek.prioriteit as Wijzigingsverzoek['prioriteit'],
      titel: verzoek.titel,
      huidige_situatie: verzoek.huidige_situatie || '',
      gewenste_situatie: verzoek.gewenste_situatie || '',
    }
  })
}

// ===========================================
// AFGERONDE PROJECTEN
// ===========================================

/**
 * Haal afgeronde projecten op
 */
export async function getAfgerondeProjecten(): Promise<AfgerondProject[]> {
  const { data: projectData, error: projectError } = await secureSelect<ProjectRow & { afgerond_op: string | null }>('projecten', {
    columns: '*',
    filters: [
      { column: 'status', operator: 'eq', value: 'afgerond' },
    ],
    order: { column: 'afgerond_op', ascending: false },
  })

  if (projectError) {
    console.error('Fout bij ophalen afgeronde projecten:', projectError)
    return []
  }

  // Get clients for name lookup
  const { data: clientData } = await secureSelect<KlantRow>('klanten', {
    columns: 'id,naam',
  })
  const clientMap = new Map((clientData || []).map(c => [c.id, c.naam]))

  return ((projectData || []) as (ProjectRow & { afgerond_op: string | null })[]).map(project => ({
    id: project.id,
    projectnummer: project.projectnummer,
    klant_naam: project.klant_id ? clientMap.get(project.klant_id) || 'Onbekende klant' : 'Onbekende klant',
    omschrijving: project.omschrijving,
    deadline: project.deadline,
    afgerond_op: project.afgerond_op || '',
  }))
}

/**
 * Markeer project als afgerond
 */
export async function markProjectAsCompleted(projectId: string): Promise<void> {
  const { error } = await secureUpdate('projecten',
    {
      status: 'afgerond',
      afgerond_op: new Date().toISOString(),
    },
    [{ column: 'id', operator: 'eq', value: projectId }]
  )

  if (error) {
    console.error('Fout bij afronden project:', error)
    throw error
  }
}

/**
 * Verwijder alle taken voor een project (cascade delete)
 */
export async function deleteTasksForProject(projectId: string): Promise<void> {
  const { error } = await secureDelete('taken', [
    { column: 'project_id', operator: 'eq', value: projectId }
  ])

  if (error) {
    console.error('Fout bij verwijderen taken voor project:', error)
    throw error
  }
}

// ===========================================
// LEGACY FUNCTIONS
// ===========================================

export const fetchEmployees = getEmployees
export const fetchClients = getClients
export const fetchWorkTypes = getWorkTypes
export const fetchTasks = getTasks
