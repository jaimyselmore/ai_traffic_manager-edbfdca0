import { useQuery } from '@tanstack/react-query';
import { getWorkTypes } from '@/lib/data/dataService';

export function useWorkTypes() {
  return useQuery({
    queryKey: ['work-types'],
    queryFn: getWorkTypes,
    staleTime: 5 * 60 * 1000, // 5 minuten
  });
}
