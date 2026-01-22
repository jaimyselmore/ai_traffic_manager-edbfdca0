// ===========================================
// DATA HOOKS - React hooks for data fetching
// Uses React Query for caching and refetching
// ===========================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getEmployees,
  getClients,
  getProjects,
  getProjectTypes,
  getWorkTypes,
  getVerlofTypes,
  getMeetingTypes,
  getWijzigingTypes,
  getIndicatievePeriodes,
  getEffortEenheden,
  getPrioriteiten,
  getNotifications,
  getTasks,
  getAllConfigurableData,
  createTask,
  updateTask,
  deleteTask,
} from './dataService';
import type { Employee, Client } from './types';

// ===========================================
// QUERY KEYS - Centralized for consistency
// ===========================================

export const dataKeys = {
  all: ['data'] as const,
  employees: () => [...dataKeys.all, 'employees'] as const,
  clients: () => [...dataKeys.all, 'clients'] as const,
  projects: () => [...dataKeys.all, 'projects'] as const,
  projectTypes: () => [...dataKeys.all, 'projectTypes'] as const,
  workTypes: () => [...dataKeys.all, 'workTypes'] as const,
  verlofTypes: () => [...dataKeys.all, 'verlofTypes'] as const,
  meetingTypes: () => [...dataKeys.all, 'meetingTypes'] as const,
  wijzigingTypes: () => [...dataKeys.all, 'wijzigingTypes'] as const,
  indicatievePeriodes: () => [...dataKeys.all, 'indicatievePeriodes'] as const,
  effortEenheden: () => [...dataKeys.all, 'effortEenheden'] as const,
  prioriteiten: () => [...dataKeys.all, 'prioriteiten'] as const,
  notifications: () => [...dataKeys.all, 'notifications'] as const,
  tasks: (weekStart: Date) => [...dataKeys.all, 'tasks', weekStart.toISOString()] as const,
  allConfigurable: () => [...dataKeys.all, 'configurable'] as const,
};

// ===========================================
// DATA FETCHING HOOKS
// ===========================================

export function useEmployees() {
  return useQuery({
    queryKey: dataKeys.employees(),
    queryFn: getEmployees,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useClients() {
  return useQuery({
    queryKey: dataKeys.clients(),
    queryFn: getClients,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: dataKeys.projects(),
    queryFn: getProjects,
    staleTime: 5 * 60 * 1000,
  });
}

export function useProjectTypes() {
  return useQuery({
    queryKey: dataKeys.projectTypes(),
    queryFn: getProjectTypes,
    staleTime: 10 * 60 * 1000, // 10 minutes - less likely to change
  });
}

export function useWorkTypes() {
  return useQuery({
    queryKey: dataKeys.workTypes(),
    queryFn: getWorkTypes,
    staleTime: 10 * 60 * 1000,
  });
}

export function useVerlofTypes() {
  return useQuery({
    queryKey: dataKeys.verlofTypes(),
    queryFn: getVerlofTypes,
    staleTime: 10 * 60 * 1000,
  });
}

export function useMeetingTypes() {
  return useQuery({
    queryKey: dataKeys.meetingTypes(),
    queryFn: getMeetingTypes,
    staleTime: 10 * 60 * 1000,
  });
}

export function useWijzigingTypes() {
  return useQuery({
    queryKey: dataKeys.wijzigingTypes(),
    queryFn: getWijzigingTypes,
    staleTime: 10 * 60 * 1000,
  });
}

export function useIndicatievePeriodes() {
  return useQuery({
    queryKey: dataKeys.indicatievePeriodes(),
    queryFn: getIndicatievePeriodes,
    staleTime: 10 * 60 * 1000,
  });
}

export function useEffortEenheden() {
  return useQuery({
    queryKey: dataKeys.effortEenheden(),
    queryFn: getEffortEenheden,
    staleTime: 10 * 60 * 1000,
  });
}

export function usePrioriteiten() {
  return useQuery({
    queryKey: dataKeys.prioriteiten(),
    queryFn: getPrioriteiten,
    staleTime: 10 * 60 * 1000,
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: dataKeys.notifications(),
    queryFn: getNotifications,
    staleTime: 1 * 60 * 1000, // 1 minute - more dynamic
  });
}

export function useTasks(weekStart: Date) {
  return useQuery({
    queryKey: dataKeys.tasks(weekStart),
    queryFn: () => getTasks(weekStart),
    staleTime: 1 * 60 * 1000,
  });
}

export function useAllConfigurableData() {
  return useQuery({
    queryKey: dataKeys.allConfigurable(),
    queryFn: getAllConfigurableData,
    staleTime: 5 * 60 * 1000,
  });
}

// ===========================================
// MUTATION HOOKS
// ===========================================

export function useCreateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dataKeys.all });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dataKeys.all });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dataKeys.all });
    },
  });
}

// ===========================================
// HELPER HOOKS
// ===========================================

export function useEmployee(employeeId: string) {
  const { data: employees, ...rest } = useEmployees();
  return {
    ...rest,
    data: employees?.find((e: Employee) => e.id === employeeId),
  };
}

export function useClient(clientId: string) {
  const { data: clients, ...rest } = useClients();
  return {
    ...rest,
    data: clients?.find((c: Client) => c.id === clientId),
  };
}
