// ===========================================
// DATA SERVICE - Abstraction layer for data access
// Now using Supabase for real data
// ===========================================

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
} from './types';

import {
  mockProjectTypes,
  mockWorkTypes,
  mockVerlofTypes,
  mockMeetingTypes,
  mockWijzigingTypes,
  mockIndicatievePeriodes,
  mockEffortEenheden,
  mockPrioriteiten,
  generateMockTasks,
} from './mockData';

import {
  getClientsFromSupabase,
  getEmployeesFromSupabase,
  getNotificationsFromSupabase,
  getTasksFromSupabase,
} from './supabaseService';

// ===========================================
// CONFIGURATION
// Set this to switch between mock and Supabase
// ===========================================
const USE_SUPABASE = true;

// ===========================================
// DATA FETCHING FUNCTIONS
// ===========================================

export async function getEmployees(): Promise<Employee[]> {
  if (USE_SUPABASE) {
    return getEmployeesFromSupabase();
  }
  // Fallback to mock - but we removed mockEmployees import
  return [];
}

export async function getClients(): Promise<Client[]> {
  if (USE_SUPABASE) {
    return getClientsFromSupabase();
  }
  return [];
}

export async function getProjectTypes(): Promise<ProjectType[]> {
  // Still using mock data - can add Supabase table later
  return mockProjectTypes;
}

export async function getWorkTypes(): Promise<WorkType[]> {
  return mockWorkTypes;
}

export async function getVerlofTypes(): Promise<VerlofType[]> {
  return mockVerlofTypes;
}

export async function getMeetingTypes(): Promise<MeetingType[]> {
  return mockMeetingTypes;
}

export async function getWijzigingTypes(): Promise<WijzigingType[]> {
  return mockWijzigingTypes;
}

export async function getIndicatievePeriodes(): Promise<IndicatievePeriode[]> {
  return mockIndicatievePeriodes;
}

export async function getEffortEenheden(): Promise<EffortEenheid[]> {
  return mockEffortEenheden;
}

export async function getPrioriteiten(): Promise<Prioriteit[]> {
  return mockPrioriteiten;
}

export async function getNotifications(): Promise<Notification[]> {
  if (USE_SUPABASE) {
    return getNotificationsFromSupabase();
  }
  return [];
}

export async function getTasks(weekStart: Date): Promise<Task[]> {
  if (USE_SUPABASE) {
    return getTasksFromSupabase(weekStart);
  }
  return generateMockTasks(weekStart);
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
  ]);

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
    planningRules: [], // TODO: Implement
  };
}

// ===========================================
// DATA MUTATION FUNCTIONS
// ===========================================

export async function updateEmployee(employee: Employee): Promise<Employee> {
  // TODO: Implement Supabase update
  console.log('Updating employee:', employee);
  return employee;
}

export async function updateClient(client: Client): Promise<Client> {
  // TODO: Implement Supabase update
  console.log('Updating client:', client);
  return client;
}

export async function createTask(task: Omit<Task, 'id'>): Promise<Task> {
  // TODO: Implement Supabase create
  const newTask = { ...task, id: `task-${Date.now()}` };
  console.log('Creating task:', newTask);
  return newTask;
}

export async function updateTask(task: Task): Promise<Task> {
  // TODO: Implement Supabase update
  console.log('Updating task:', task);
  return task;
}

export async function deleteTask(taskId: string): Promise<void> {
  // TODO: Implement Supabase delete
  console.log('Deleting task:', taskId);
}
