// ===========================================
// BACKWARD COMPATIBILITY LAYER
// Empty exports for legacy imports - all data now comes from Supabase
// Date helpers moved to @/lib/helpers/dateHelpers
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
export const generateMockTasks = (_weekStart?: Date) => [];
export const generateMockAgendaEvents = (_weekStart?: Date, _employee?: string) => [];

// Re-export date helpers from their new location
export {
  getWeekNumber,
  getWeekStart,
  formatDateRange,
  getWeekEnd,
  isCurrentWeek,
} from './helpers/dateHelpers';
