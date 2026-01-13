import { useQuery } from '@tanstack/react-query';
import { getEmployees } from '@/lib/data/dataService';

export function useEmployees() {
  return useQuery({
    queryKey: ['employees'],
    queryFn: getEmployees,
    staleTime: 5 * 60 * 1000, // 5 minuten
  });
}
