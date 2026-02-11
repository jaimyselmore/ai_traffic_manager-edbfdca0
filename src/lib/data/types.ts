// ===========================================
// CENTRALIZED DATA TYPES
// All configurable data that will come from Supabase
// ===========================================

// ---- EMPLOYEES (Supabase: "medewerkers") ----
export interface Employee {
  id: string;
  name: string;
  email: string;
  primaryRole: string;
  secondaryRole?: string;
  tertiaryRole?: string;
  discipline: string;
  duoTeam?: string;
  isPlanner: boolean | null;
  workHours: number | null;
  partTimeDay?: string;
  available: boolean | null;
  skills: string;
  notes: string;
  // Legacy compatibility
  role?: string;
  avatar?: string;
  availability?: 'available' | 'busy' | 'full';
  werknemerId?: number;
}

// ---- CLIENTS (Supabase: "klanten") ----
export interface Client {
  id: string;
  name: string;
  code?: string;
  klantnummer?: string;
  reistijd_minuten?: number | null;
  interne_notities?: string;
  planning_instructies?: string;
}

// ---- PROJECT TYPES (Sheet: "Project Types") ----
export interface ProjectType {
  id: string;
  name: string;
  label?: string;
  description?: string;
}

// ---- WORK TYPES / DISCIPLINES (Supabase: "disciplines") ----
export interface WorkType {
  id: number | string;
  name: string;
  label?: string;
  description?: string;
  color?: string;
}

// ---- VERLOF TYPES (Sheet: "Verlof Types") ----
export interface VerlofType {
  id: string;
  name: string;
  label?: string;
  description?: string;
}

// ---- MEETING TYPES (Sheet: "Meeting Types") ----
export interface MeetingType {
  id: string;
  name: string;
  label?: string;
  description?: string;
}

// ---- WIJZIGING TYPES (Sheet: "Wijziging Types") ----
export interface WijzigingType {
  id: string;
  name: string;
  label?: string;
  description?: string;
}

// ---- INDICATIEVE PERIODES (Sheet: "Periodes" or computed) ----
export interface IndicatievePeriode {
  id: string;
  name: string;
  label?: string;
  description?: string;
  days?: number;
}

// ---- EFFORT EENHEDEN (Sheet: "Configuratie") ----
export interface EffortEenheid {
  id: string;
  name: string;
  label?: string;
  description?: string;
}

// ---- PRIORITEITEN (Sheet: "Configuratie") ----
export interface Prioriteit {
  id: string;
  name: string;
  label?: string;
  description?: string;
  color?: string;
}

// ---- PLANNING RULES (Sheet: "Regels") ----
export interface PlanningRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

// ---- NOTIFICATIONS (Supabase: "notificaties") ----
export interface Notification {
  id: string;
  type: 'late' | 'upcoming' | 'review' | 'change' | 'active' | string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description?: string;
  projectNumber?: string;
  clientName?: string;
  deadline?: string;
  count?: number;
  isDone: boolean;
  // Legacy fields
  clientId?: string;
  client?: string;
  projectId?: string;
  project?: string;
  workType?: string;
  employeeId?: string;
  employee?: string;
}

// ---- PROJECTS (Sheet: "Projecten") ----
export interface Project {
  id: string;
  clientId: string;
  name: string;
  projectType: string;
  deadline?: string;
  indicatievePeriode?: string;
  prioriteit: string;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// ---- TASKS / PLANNING BLOCKS (Supabase: "taken") ----
export interface Task {
  id: string;
  employeeId: string;
  projectId: string;
  clientName: string;
  projectNumber: string;
  projectTitel?: string;
  phaseName: string;
  workType: string;
  discipline: string;
  weekStart: Date;
  dayOfWeek: number;
  startHour: number;
  durationHours: number;
  status: 'concept' | 'vast';
  isHardLock: boolean | null;
  createdBy: string;
  // Legacy compatibility fields
  title?: string;
  clientId?: string;
  type?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  planStatus?: 'concept' | 'vast';
  projectType?: 'productie' | 'nieuw_project' | 'meeting' | 'verlof' | 'wijziging';
  faseNaam?: string;
}

// ---- DASHBOARD STATS (Computed from other sheets) ----
export interface DashboardStats {
  overdue: number;
  upcoming: number;
  reviews: number;
  changes: number;
  activeProjects: number;
}

// ---- ALL CONFIGURABLE DATA ----
export interface ConfigurableData {
  employees: Employee[];
  clients: Client[];
  projectTypes: ProjectType[];
  workTypes: WorkType[];
  verlofTypes: VerlofType[];
  meetingTypes: MeetingType[];
  wijzigingTypes: WijzigingType[];
  indicatievePeriodes: IndicatievePeriode[];
  effortEenheden: EffortEenheid[];
  prioriteiten: Prioriteit[];
  planningRules: PlanningRule[];
}
