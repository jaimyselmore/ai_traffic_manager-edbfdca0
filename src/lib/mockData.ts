// ===========================================
// BACKWARD COMPATIBILITY LAYER
// Empty exports for legacy imports - all data now comes from Supabase
// ===========================================

export type {
  Employee,
  Client,
  Task,
  DashboardStats,
} from './data/types';

// Export empty arrays for backward compatibility
export const mockEmployees: any[] = [];
export const mockClients: any[] = [];
export const mockDashboardStats = {
  totalProjects: 0,
  activeProjects: 0,
  completedTasks: 0,
  pendingTasks: 0,
};
export const generateMockTasks = () => [];

// Keep date utility functions here (not configurable data)
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
  const year = weekEnd.getFullYear();

  return `${startDay} t/m ${endDay} ${month} ${year}`;
};
