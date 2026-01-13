import { useQuery } from '@tanstack/react-query';
import { getClients } from '@/lib/data/dataService';

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: getClients,
    staleTime: 5 * 60 * 1000, // 5 minuten
  });
}
