// ===========================================
// MOCK DATA - Will be replaced by Google Sheets API
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
  DashboardStats,
} from './types';

// ---- EMPLOYEES ----
export const mockEmployees: Employee[] = [
  { id: '1', name: 'Anna de Vries', role: 'Art Director', availability: 'available' },
  { id: '2', name: 'Bas Jansen', role: 'Copywriter', availability: 'busy' },
  { id: '3', name: 'Carmen van Dijk', role: 'Designer', availability: 'available' },
  { id: '4', name: 'Dennis Bakker', role: 'Project Manager', availability: 'full' },
  { id: '5', name: 'Eva Smit', role: 'Motion Designer', availability: 'busy' },
  { id: '6', name: 'Frank Peters', role: 'Developer', availability: 'available' },
];

// ---- CLIENTS ----
export const mockClients: Client[] = [
  { id: '1', name: 'HEMA' },
  { id: '2', name: 'Jumbo' },
  { id: '3', name: 'Albert Heijn' },
  { id: '4', name: 'Rabobank' },
  { id: '5', name: 'KLM' },
  { id: '6', name: 'Philips' },
];

// ---- PROJECT TYPES ----
export const mockProjectTypes: ProjectType[] = [
  { id: 'campagne', label: 'Campagne' },
  { id: 'website', label: 'Website' },
  { id: 'branding', label: 'Branding' },
  { id: 'content', label: 'Content' },
  { id: 'video', label: 'Video' },
  { id: 'event', label: 'Event' },
  { id: 'other', label: 'Other' },
];

// ---- WORK TYPES / DISCIPLINES ----
export const mockWorkTypes: WorkType[] = [
  { id: 'concept', label: 'Conceptontwikkeling', color: 'bg-task-concept' },
  { id: 'review', label: 'Interne review/team-update/meeting', color: 'bg-task-review' },
  { id: 'uitwerking', label: 'Conceptuitwerking', color: 'bg-task-uitwerking' },
  { id: 'productie', label: 'Productie', color: 'bg-task-productie' },
  { id: 'extern', label: 'Afspraken/meeting extern', color: 'bg-task-extern' },
  { id: 'optie', label: 'Optie', color: 'bg-task-optie' },
];

// ---- VERLOF TYPES ----
export const mockVerlofTypes: VerlofType[] = [
  { id: 'ziek', label: 'Ziekmelding' },
  { id: 'vakantie', label: 'Vakantie' },
  { id: 'persoonlijk', label: 'Persoonlijk verlof' },
  { id: 'bijzonder', label: 'Bijzonder verlof' },
];

// ---- MEETING TYPES ----
export const mockMeetingTypes: MeetingType[] = [
  { id: 'meeting', label: 'Meeting' },
  { id: 'presentatie', label: 'Presentatie' },
  { id: 'brainstorm', label: 'Brainstorm' },
  { id: 'review', label: 'Review' },
  { id: 'kickoff', label: 'Kickoff' },
];

// ---- WIJZIGING TYPES ----
export const mockWijzigingTypes: WijzigingType[] = [
  { id: 'content', label: 'Content aanpassing' },
  { id: 'design', label: 'Design wijziging' },
  { id: 'deadline', label: 'Deadline verschuiving' },
  { id: 'scope', label: 'Scope uitbreiding' },
  { id: 'anders', label: 'Anders' },
];

// ---- INDICATIEVE PERIODES ----
export const mockIndicatievePeriodes: IndicatievePeriode[] = [
  { id: 'q1-2026', label: 'Q1 2026' },
  { id: 'q2-2026', label: 'Q2 2026' },
  { id: 'q3-2026', label: 'Q3 2026' },
  { id: 'q4-2026', label: 'Q4 2026' },
  { id: 'geen-voorkeur', label: 'Geen voorkeur' },
];

// ---- EFFORT EENHEDEN ----
export const mockEffortEenheden: EffortEenheid[] = [
  { id: 'uren', label: 'uren' },
  { id: 'dagen', label: 'dagen' },
  { id: 'weken', label: 'weken' },
];

// ---- PRIORITEITEN ----
export const mockPrioriteiten: Prioriteit[] = [
  { id: 'hoog', label: 'Hoog' },
  { id: 'normaal', label: 'Normaal' },
  { id: 'laag', label: 'Laag' },
];

// ---- DASHBOARD STATS ----
export const mockDashboardStats: DashboardStats = {
  overdue: 3,
  upcoming: 8,
  reviews: 5,
  changes: 2,
  activeProjects: 12,
};

// ---- NOTIFICATIONS ----
export const mockNotifications: Notification[] = [
  // Te laat (late)
  { id: '1', type: 'late', clientId: '1', client: 'Acme Corp', project: 'Brand Refresh 2025', workType: 'Conceptontwikkeling', employeeId: '1', employee: 'Jan de Vries', deadline: '2 dec 2025', severity: 'high', isDone: false },
  { id: '2', type: 'late', clientId: '2', client: 'TechStart BV', project: 'Website Redesign', workType: 'Productie', employeeId: '2', employee: 'Lisa Bakker', deadline: '28 nov 2025', severity: 'high', isDone: false },
  { id: '3', type: 'late', clientId: '3', client: 'GreenLeaf', project: 'Social Campaign', workType: 'Content', employeeId: '3', employee: 'Peter Smit', deadline: '1 dec 2025', severity: 'medium', isDone: false },
  
  // Aankomende deadlines (upcoming)
  { id: '4', type: 'upcoming', clientId: '4', client: 'FinanceHub', project: 'Annual Report Design', workType: 'Productie', employeeId: '4', employee: 'Anna Jansen', deadline: '12 dec 2025', severity: 'medium', isDone: false },
  { id: '5', type: 'upcoming', clientId: '5', client: 'SportMax', project: 'Event Branding', workType: 'Conceptuitwerking', employeeId: '5', employee: 'Mark de Boer', deadline: '15 dec 2025', severity: 'low', isDone: false },
  { id: '6', type: 'upcoming', clientId: '1', client: 'Acme Corp', project: 'Q1 Campaign', workType: 'Conceptontwikkeling', employeeId: '1', employee: 'Jan de Vries', deadline: '18 dec 2025', severity: 'medium', isDone: false },
  { id: '7', type: 'upcoming', clientId: '2', client: 'TechStart BV', project: 'App Launch', workType: 'Video', employeeId: '2', employee: 'Lisa Bakker', deadline: '20 dec 2025', severity: 'low', isDone: false },
  { id: '8', type: 'upcoming', clientId: '3', client: 'GreenLeaf', project: 'Product Packaging', workType: 'Productie', employeeId: '3', employee: 'Peter Smit', deadline: '22 dec 2025', severity: 'low', isDone: false },
  
  // Reviews
  { id: '9', type: 'review', clientId: '4', client: 'FinanceHub', project: 'Brand Guidelines', workType: 'Interne review', employeeId: '4', employee: 'Anna Jansen', deadline: '10 dec 2025', severity: 'medium', isDone: false },
  { id: '10', type: 'review', clientId: '5', client: 'SportMax', project: 'Logo Varianten', workType: 'Interne review', employeeId: '5', employee: 'Mark de Boer', deadline: '11 dec 2025', severity: 'low', isDone: false },
  
  // Gemiste wijzigingen (change)
  { id: '11', type: 'change', clientId: '1', client: 'Acme Corp', project: 'Brand Refresh 2025', workType: 'Wijziging', employeeId: '1', employee: 'Jan de Vries', deadline: '5 dec 2025', severity: 'medium', isDone: false },
  { id: '12', type: 'change', clientId: '2', client: 'TechStart BV', project: 'Website Redesign', workType: 'Scope wijziging', employeeId: '2', employee: 'Lisa Bakker', deadline: '6 dec 2025', severity: 'low', isDone: false },
  { id: '13', type: 'change', clientId: '3', client: 'GreenLeaf', project: 'Social Campaign', workType: 'Team wijziging', employeeId: '3', employee: 'Peter Smit', deadline: '7 dec 2025', severity: 'low', isDone: false },
  { id: '14', type: 'change', clientId: '4', client: 'FinanceHub', project: 'Annual Report', workType: 'Deadline wijziging', employeeId: '4', employee: 'Anna Jansen', deadline: '8 dec 2025', severity: 'medium', isDone: false },
  
  // Actieve projecten (active)
  { id: '15', type: 'active', clientId: '1', client: 'Acme Corp', project: 'Brand Refresh 2025', workType: 'Campagne', employeeId: '1', employee: 'Jan de Vries', deadline: '31 jan 2026', severity: 'low', isDone: false },
  { id: '16', type: 'active', clientId: '2', client: 'TechStart BV', project: 'Website Redesign', workType: 'Website', employeeId: '2', employee: 'Lisa Bakker', deadline: '15 feb 2026', severity: 'low', isDone: false },
  { id: '17', type: 'active', clientId: '3', client: 'GreenLeaf', project: 'Social Campaign Q1', workType: 'Content', employeeId: '3', employee: 'Peter Smit', deadline: '28 feb 2026', severity: 'low', isDone: false },
  { id: '18', type: 'active', clientId: '4', client: 'FinanceHub', project: 'Annual Report 2025', workType: 'Branding', employeeId: '4', employee: 'Anna Jansen', deadline: '20 mrt 2026', severity: 'low', isDone: false },
  { id: '19', type: 'active', clientId: '5', client: 'SportMax', project: 'Event Branding', workType: 'Event', employeeId: '5', employee: 'Mark de Boer', deadline: '10 apr 2026', severity: 'low', isDone: false },
  { id: '20', type: 'active', clientId: '6', client: 'MediCare', project: 'Recruitment Video', workType: 'Video', employeeId: '2', employee: 'Lisa Bakker', deadline: '30 apr 2026', severity: 'low', isDone: false },
  { id: '21', type: 'active', clientId: '1', client: 'FoodFirst', project: 'Packaging Redesign', workType: 'Branding', employeeId: '1', employee: 'Jan de Vries', deadline: '15 mei 2026', severity: 'low', isDone: false },
  { id: '22', type: 'active', clientId: '2', client: 'TravelWise', project: 'App Campaign', workType: 'Campagne', employeeId: '3', employee: 'Peter Smit', deadline: '1 jun 2026', severity: 'low', isDone: false },
  { id: '23', type: 'active', clientId: '3', client: 'EduLearn', project: 'Platform Branding', workType: 'Website', employeeId: '4', employee: 'Anna Jansen', deadline: '20 jun 2026', severity: 'low', isDone: false },
  { id: '24', type: 'active', clientId: '4', client: 'HomeStyle', project: 'Product Launch', workType: 'Content', employeeId: '5', employee: 'Mark de Boer', deadline: '15 jul 2026', severity: 'low', isDone: false },
  { id: '25', type: 'active', clientId: '5', client: 'AutoDrive', project: 'Brand Identity', workType: 'Branding', employeeId: '1', employee: 'Jan de Vries', deadline: '30 jul 2026', severity: 'low', isDone: false },
  { id: '26', type: 'active', clientId: '6', client: 'PetCare Plus', project: 'Social Strategy', workType: 'Content', employeeId: '2', employee: 'Lisa Bakker', deadline: '15 aug 2026', severity: 'low', isDone: false },
];

// ---- HELPER FUNCTIONS FOR TASKS ----
export const generateMockTasks = (weekStart: Date): Task[] => {
  const tasks: Task[] = [];
  const types = mockWorkTypes.map(wt => wt.id);
  
  mockEmployees.forEach((employee) => {
    for (let day = 0; day < 5; day++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];
      
      const numTasks = Math.floor(Math.random() * 3) + 1;
      const usedSlots: { start: number; end: number }[] = [];
      
      for (let t = 0; t < numTasks; t++) {
        const client = mockClients[Math.floor(Math.random() * mockClients.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let startHour = 9 + Math.floor(Math.random() * 7);
        let duration = Math.floor(Math.random() * 3) + 1;
        
        if (startHour === 13) startHour = 14;
        if (startHour < 13 && startHour + duration > 13) {
          duration = 13 - startHour;
        }
        
        const endHour = Math.min(startHour + duration, 18);
        
        const hasOverlap = usedSlots.some(
          slot => !(endHour <= slot.start || startHour >= slot.end)
        );
        
        if (!hasOverlap && startHour < 18) {
          usedSlots.push({ start: startHour, end: endHour });
          tasks.push({
            id: `${employee.id}-${dateStr}-${t}`,
            title: `${client.name} - ${type}`,
            clientId: client.id,
            employeeId: employee.id,
            type,
            date: dateStr,
            startTime: `${startHour.toString().padStart(2, '0')}:00`,
            endTime: `${endHour.toString().padStart(2, '0')}:00`,
            planStatus: Math.random() > 0.7 ? 'concept' : 'vast',
          });
        }
      }
    }
  });
  
  return tasks;
};
