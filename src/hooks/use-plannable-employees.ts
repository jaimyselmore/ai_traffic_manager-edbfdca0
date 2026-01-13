import { useQuery } from '@tanstack/react-query';
import { getPlannableEmployees } from '@/lib/data/dataService';

export function usePlannableEmployees() {
  return useQuery({
    queryKey: ['plannable-employees'],
    queryFn: getPlannableEmployees,
    staleTime: 5 * 60 * 1000, // 5 minuten
  });
}
