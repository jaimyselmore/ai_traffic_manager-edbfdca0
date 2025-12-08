// ===========================================
// DATA SERVICE - Abstraction layer for data access
// Replace mock implementations with Google Sheets API calls
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
  mockEmployees,
  mockClients,
  mockProjectTypes,
  mockWorkTypes,
  mockVerlofTypes,
  mockMeetingTypes,
  mockWijzigingTypes,
  mockIndicatievePeriodes,
  mockEffortEenheden,
  mockPrioriteiten,
  mockNotifications,
  generateMockTasks,
} from './mockData';

// ===========================================
// CONFIGURATION
// Set this to switch between mock and Google Sheets
// ===========================================
const USE_GOOGLE_SHEETS = false;

// Google Sheets configuration (to be set when connecting)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const GOOGLE_SHEETS_CONFIG = {
  spreadsheetId: '', // Will be set when connecting
  apiKey: '', // Will be stored as secret
  sheets: {
    employees: 'Medewerkers',
    clients: 'Klanten',
    projectTypes: 'Project Types',
    workTypes: 'Disciplines',
    verlofTypes: 'Verlof Types',
    meetingTypes: 'Meeting Types',
    wijzigingTypes: 'Wijziging Types',
    periodes: 'Periodes',
    configuratie: 'Configuratie',
    planning: 'Planning',
    projecten: 'Projecten',
    regels: 'Regels',
  },
};

// ===========================================
// DATA FETCHING FUNCTIONS
// Each function can be switched to Google Sheets
// ===========================================

export async function getEmployees(): Promise<Employee[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
    // return await fetchFromGoogleSheets<Employee>('employees');
  }
  return mockEmployees;
}

export async function getClients(): Promise<Client[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
  }
  return mockClients;
}

export async function getProjectTypes(): Promise<ProjectType[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
  }
  return mockProjectTypes;
}

export async function getWorkTypes(): Promise<WorkType[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
  }
  return mockWorkTypes;
}

export async function getVerlofTypes(): Promise<VerlofType[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
  }
  return mockVerlofTypes;
}

export async function getMeetingTypes(): Promise<MeetingType[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
  }
  return mockMeetingTypes;
}

export async function getWijzigingTypes(): Promise<WijzigingType[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
  }
  return mockWijzigingTypes;
}

export async function getIndicatievePeriodes(): Promise<IndicatievePeriode[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
  }
  return mockIndicatievePeriodes;
}

export async function getEffortEenheden(): Promise<EffortEenheid[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
  }
  return mockEffortEenheden;
}

export async function getPrioriteiten(): Promise<Prioriteit[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
  }
  return mockPrioriteiten;
}

export async function getNotifications(): Promise<Notification[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch or compute from tasks
  }
  return mockNotifications;
}

export async function getTasks(weekStart: Date): Promise<Task[]> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets fetch
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
// These will write back to Google Sheets
// ===========================================

export async function updateEmployee(employee: Employee): Promise<Employee> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets update
  }
  // For now, just return the employee (mock update)
  console.log('Updating employee:', employee);
  return employee;
}

export async function updateClient(client: Client): Promise<Client> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets update
  }
  console.log('Updating client:', client);
  return client;
}

export async function createTask(task: Omit<Task, 'id'>): Promise<Task> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets create
  }
  const newTask = { ...task, id: `task-${Date.now()}` };
  console.log('Creating task:', newTask);
  return newTask;
}

export async function updateTask(task: Task): Promise<Task> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets update
  }
  console.log('Updating task:', task);
  return task;
}

export async function deleteTask(taskId: string): Promise<void> {
  if (USE_GOOGLE_SHEETS) {
    // TODO: Implement Google Sheets delete
  }
  console.log('Deleting task:', taskId);
}

// ===========================================
// HELPER: Google Sheets fetch template
// Uncomment and use when implementing Google Sheets
// ===========================================

/*
async function fetchFromGoogleSheets<T>(sheetName: string): Promise<T[]> {
  const { spreadsheetId, apiKey, sheets } = GOOGLE_SHEETS_CONFIG;
  const range = sheets[sheetName as keyof typeof sheets];
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from Google Sheets: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  // Parse rows - first row is headers
  const [headers, ...rows] = data.values || [];
  
  return rows.map((row: string[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || '';
    });
    return obj as unknown as T;
  });
}

async function writeToGoogleSheets<T>(sheetName: string, data: T): Promise<void> {
  // This requires OAuth2 authentication
  // Implementation depends on your auth setup
  console.log('Writing to sheet:', sheetName, data);
}
*/
