import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Project {
  id: string;
  klant_id: string;
  projectnummer: string;
  titel: string | null;
  omschrijving: string;
  projecttype: string;
  deadline: string | null;
  status: string;
  created_at: string;
  klant_naam?: string;
  // Relaties
  klanten?: {
    id: string;
    naam: string;
    klantnummer: string;
  };
}

export function useProjects(status?: 'concept' | 'vast' | 'afgerond') {
  return useQuery({
    queryKey: ['projects', status],
    queryFn: async () => {
      let query = supabase
        .from('projecten')
        .select(`
          id,
          klant_id,
          projectnummer,
          titel,
          omschrijving,
          projecttype,
          deadline,
          status,
          created_at,
          klanten (
            id,
            naam,
            klantnummer
          )
        `)
        .order('created_at', { ascending: false });

      // Filter by status if provided
      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Fout bij ophalen projecten: ${error.message}`);
      }

      // Map data to include klant_naam for easier access
      return ((data || []) as any[]).map(p => ({
        ...p,
        klant_naam: p.klanten?.naam || 'Onbekende klant'
      })) as Project[];
    },
    staleTime: 5 * 60 * 1000, // 5 minuten
  });
}
