// ===========================================
// CENTRALIZED DATA TYPES
// All configurable data that will come from Google Sheets
// ===========================================

// ---- EMPLOYEES (Sheet: "Medewerkers") ----
export interface Employee {
  id: string;
  name: string;
  role: string;
  email?: string;
  avatar?: string;
  availability: 'available' | 'busy' | 'full';
  // Future fields from Google Sheets:
  // department?: string;
  // hoursPerWeek?: number;
  // startDate?: string;
}

// ---- CLIENTS (Sheet: "Klanten") ----
export interface Client {
  id: string;
  name: string;
  // Future fields:
  // contactPerson?: string;
  // email?: string;
  // isActive?: boolean;
}

// ---- PROJECT TYPES (Sheet: "Project Types") ----
export interface ProjectType {
  id: string;
  label: string;
  // Future fields:
  // estimatedHours?: number;
  // defaultDisciplines?: string[];
}

// ---- WORK TYPES / DISCIPLINES (Sheet: "Disciplines") ----
export interface WorkType {
  id: string;
  label: string;
  color: string; // Tailwind class like 'bg-task-concept'
  // Future fields:
  // category?: string;
}

// ---- VERLOF TYPES (Sheet: "Verlof Types") ----
export interface VerlofType {
  id: string;
  label: string;
}

// ---- MEETING TYPES (Sheet: "Meeting Types") ----
export interface MeetingType {
  id: string;
  label: string;
}

// ---- WIJZIGING TYPES (Sheet: "Wijziging Types") ----
export interface WijzigingType {
  id: string;
  label: string;
}

// ---- INDICATIEVE PERIODES (Sheet: "Periodes" or computed) ----
export interface IndicatievePeriode {
  id: string;
  label: string;
}

// ---- EFFORT EENHEDEN (Sheet: "Configuratie") ----
export interface EffortEenheid {
  id: string;
  label: string;
}

// ---- PRIORITEITEN (Sheet: "Configuratie") ----
export interface Prioriteit {
  id: string;
  label: string;
}

// ---- PLANNING RULES (Sheet: "Regels") ----
export interface PlanningRule {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  // Future: complex rule definitions
}

// ---- NOTIFICATIONS / TASKS (Sheet: "Taken" or computed) ----
export interface Notification {
  id: string;
  type: 'late' | 'upcoming' | 'review' | 'change' | 'active';
  clientId: string;
  client: string;
  projectId?: string;
  project: string;
  workType: string;
  employeeId: string;
  employee: string;
  deadline: string;
  severity: 'low' | 'medium' | 'high';
  isDone: boolean;
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

// ---- TASKS / PLANNING BLOCKS (Sheet: "Planning") ----
export interface Task {
  id: string;
  title: string;
  clientId: string;
  employeeId: string;
  projectId?: string;
  type: string; // workType id
  date: string;
  startTime: string;
  endTime: string;
  planStatus: 'concept' | 'vast'; // concept = semi-transparent, vast = full color
  projectType?: 'productie' | 'nieuw_project' | 'meeting' | 'verlof' | 'wijziging';
  faseNaam?: string; // e.g. 'PP', 'PPM', 'Shoot', etc.
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
