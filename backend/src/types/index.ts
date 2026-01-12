// ============================================
// TYPES - Gedeelde TypeScript interfaces
// ============================================

// Google Sheets Data Types (referentiedata)
export interface Werknemer {
  werknemer_id: number
  naam: string
  email: string | null
  primaire_rol: string
  tweede_rol?: string
  derde_rol?: string
  discipline: string
  duo_team?: string
  is_planner: boolean
  werkuren: number
  parttime_dag?: string
  beschikbaar: boolean
  vaardigheden: string
  notities?: string
}

export interface RolProfiel {
  rol_nummer: number
  rol_naam: string
  beschrijving: string
  taken: string
}

export interface Discipline {
  naam: string
  beschrijving: string
  kleur_hex?: string
}

export interface Regel {
  regel_id: string
  titel_kort: string
  categorie: string
  ernst: 'Hard blok' | 'Waarschuwing' | 'Suggestie'
  voorwaarde_kort: string
  actie_kort: string
  max_per_dag?: string
  parameters?: string
}

// Supabase Database Types
export interface User {
  id: string
  email: string
  naam: string
  rol: string
  werknemer_id: number | null
  is_planner: boolean
  created_at: string
  updated_at: string
}

export interface Klant {
  id: string
  klantnummer: string
  naam: string
  contactpersoon?: string
  email?: string
  telefoon?: string
  adres?: string
  notities?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  klant_id: string
  projectnummer: string
  volgnummer: number
  omschrijving: string
  projecttype: 'productie' | 'guiding_idea' | 'nieuw_project' | 'algemeen'
  datum_aanvraag: string
  deadline: string
  status: 'concept' | 'vast' | 'afgerond'
  opmerkingen?: string
  adres_klant?: string
  info_klant?: string
  creatie_team?: { enabled: boolean; duo?: string }
  account_team?: { enabled: boolean; verantwoordelijke?: string }
  productie_team?: { enabled: boolean; producer?: string }
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectFase {
  id: string
  project_id: string
  fase_naam: string
  fase_type: 'fase' | 'meeting' | 'presentatie' | 'deadline'
  medewerkers: string[]
  inspanning_dagen?: number
  start_datum?: string
  eind_datum?: string
  datum_tijd?: string
  locatie?: string
  is_hard_lock: boolean
  volgorde: number
  opmerkingen?: string
  created_at: string
  updated_at: string
}

export interface Taak {
  id: string
  project_id: string
  fase_id?: string
  werknemer_naam: string
  klant_naam: string
  project_nummer: string
  fase_naam: string
  werktype: string
  discipline: string
  week_start: string // ISO date (YYYY-MM-DD)
  dag_van_week: number // 0=ma, 1=di, 2=wo, 3=do, 4=vr
  start_uur: number // 9-18
  duur_uren: number // 1-8
  plan_status: 'concept' | 'vast'
  is_hard_lock: boolean
  created_by: string
  locked_by?: string
  created_at: string
  updated_at: string
}

export interface Meeting {
  id: string
  project_id?: string
  onderwerp: string
  type: string
  datum: string // ISO date
  start_tijd: string // HH:MM
  eind_tijd: string // HH:MM
  locatie?: string
  deelnemers: string[]
  is_hard_lock: boolean
  status: 'concept' | 'vast'
  created_by: string
  created_at: string
  updated_at: string
}

export interface VerlofAanvraag {
  id: string
  werknemer_naam: string
  type: string
  start_datum: string
  eind_datum: string
  reden?: string
  status: 'concept' | 'goedgekeurd' | 'afgewezen'
  created_by: string
  created_at: string
  updated_at: string
}

export interface Wijzigingsverzoek {
  id: string
  project_id: string
  type_wijziging: string
  beschrijving: string
  nieuwe_deadline?: string
  betrokken_mensen: string[]
  status: 'in_behandeling' | 'goedgekeurd' | 'afgewezen'
  impact?: 'laag' | 'medium' | 'hoog'
  extra_uren?: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface Notificatie {
  id: string
  type: 'te_laat' | 'aankomende_deadline' | 'review_nodig' | 'wijziging' | 'actief_project'
  severity: 'low' | 'medium' | 'high'
  titel: string
  beschrijving?: string
  project_nummer?: string
  klant_naam?: string
  deadline?: string
  aantal?: number
  is_done: boolean
  voor_werknemer?: string
  created_at: string
  updated_at: string
}

export interface AuditLog {
  id: string
  user_id: string
  actie: 'created' | 'updated' | 'deleted'
  entiteit_type: string
  entiteit_id: string
  oude_waarde?: Record<string, any>
  nieuwe_waarde?: Record<string, any>
  ip_address?: string
  created_at: string
}

// Request/Response DTOs (Data Transfer Objects)
export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: string
    email: string
    naam: string
    rol: string
    is_planner: boolean
  }
}

export interface CreateTaakDTO {
  project_id: string
  fase_id?: string
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
  plan_status?: 'concept' | 'vast'
  is_hard_lock?: boolean
}

export interface UpdateTaakDTO {
  dag_van_week?: number
  start_uur?: number
  duur_uren?: number
  plan_status?: 'concept' | 'vast'
}

// Conflict Detection Types
export interface Conflict {
  type: 'overlap' | 'verlof' | 'max_capaciteit' | 'hard_lock' | 'werktijden' | 'max_presentaties'
  severity: 'error' | 'warning'
  message: string
  details?: any
}

// Google Sheets Cache
export interface SheetsCache {
  werknemers: Werknemer[]
  rollen: RolProfiel[]
  disciplines: Discipline[]
  regels: Regel[]
  lastSync: Date
}

// Express Request met User (na auth middleware)
export interface AuthRequest extends Express.Request {
  user?: {
    id: string
    email: string
    naam: string
    rol: string
    is_planner: boolean
  }
}
