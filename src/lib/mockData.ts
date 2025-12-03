export interface Employee {
  id: string;
  name: string;
  role: string;
  avatar?: string;
}

export interface Client {
  id: string;
  name: string;
}

export interface Task {
  id: string;
  title: string;
  clientId: string;
  employeeId: string;
  type: 'concept' | 'review' | 'uitwerking' | 'productie' | 'extern' | 'optie';
  date: string;
  startTime: string;
  endTime: string;
}

export interface DashboardStats {
  overdue: number;
  upcoming: number;
  reviews: number;
  changes: number;
  activeProjects: number;
}

export const mockEmployees: Employee[] = [
  { id: '1', name: 'Anna de Vries', role: 'Art Director' },
  { id: '2', name: 'Bas Jansen', role: 'Copywriter' },
  { id: '3', name: 'Carmen van Dijk', role: 'Designer' },
  { id: '4', name: 'Dennis Bakker', role: 'Project Manager' },
  { id: '5', name: 'Eva Smit', role: 'Motion Designer' },
  { id: '6', name: 'Frank Peters', role: 'Developer' },
];

export const mockClients: Client[] = [
  { id: '1', name: 'HEMA' },
  { id: '2', name: 'Jumbo' },
  { id: '3', name: 'Albert Heijn' },
  { id: '4', name: 'Rabobank' },
  { id: '5', name: 'KLM' },
  { id: '6', name: 'Philips' },
];

export const mockDashboardStats: DashboardStats = {
  overdue: 3,
  upcoming: 8,
  reviews: 5,
  changes: 2,
  activeProjects: 12,
};

export const generateMockTasks = (weekStart: Date): Task[] => {
  const tasks: Task[] = [];
  const types: Task['type'][] = ['concept', 'review', 'uitwerking', 'productie', 'extern', 'optie'];
  
  mockEmployees.forEach((employee) => {
    for (let day = 0; day < 5; day++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];
      
      // Add 1-3 tasks per day per employee
      const numTasks = Math.floor(Math.random() * 3) + 1;
      const usedSlots: { start: number; end: number }[] = [];
      
      for (let t = 0; t < numTasks; t++) {
        const client = mockClients[Math.floor(Math.random() * mockClients.length)];
        const type = types[Math.floor(Math.random() * types.length)];
        
        let startHour = 9 + Math.floor(Math.random() * 7);
        let duration = Math.floor(Math.random() * 3) + 1;
        
        // Avoid lunch time
        if (startHour === 13) startHour = 14;
        if (startHour < 13 && startHour + duration > 13) {
          duration = 13 - startHour;
        }
        
        const endHour = Math.min(startHour + duration, 18);
        
        // Check for overlap
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
          });
        }
      }
    }
  });
  
  return tasks;
};

export const getWeekNumber = (date: Date): number => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

export const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const formatDateRange = (weekStart: Date): string => {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 4);
  
  const months = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december'
  ];
  
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const month = months[weekEnd.getMonth()];
  
  return `${startDay} t/m ${endDay} ${month}`;
};
