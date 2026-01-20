import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

interface Task {
  id: string;
  werknemer_naam: string;
  klant_naam: string;
  project_nummer: string;
  fase_naam: string;
  werktype: string;
  discipline: string;
  week_start: string;
  dag_van_week: number;
  start_uur: number;
  duur_uren: number;
  plan_status: 'concept' | 'vast';
  is_hard_lock: boolean;
}

export function useTasks(weekStart: Date, employeeName?: string) {
  const weekStartISO = weekStart.toISOString().split('T')[0];

  return useQuery({
    queryKey: ['tasks', weekStartISO, employeeName],
    queryFn: async () => {
      let query = supabase
        .from('taken')
        .select('*')
        .eq('week_start', weekStartISO)
        .order('dag_van_week')
        .order('start_uur');

      // Filter by employee name if provided
      if (employeeName) {
        query = query.eq('werknemer_naam', employeeName);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Fout bij ophalen taken: ${error.message}`);
      }

      return (data || []) as Task[];
    },
    staleTime: 5 * 60 * 1000, // 5 minuten
    enabled: !!weekStartISO, // Only run query if we have a week start
  });
}
