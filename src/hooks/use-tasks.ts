import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

// Task interface matching what Planner expects
export interface Task {
  id: string;
  werknemer_naam: string;
  klant_naam: string;
  project_nummer: string;
  project_titel?: string;
  fase_naam: string;
  werktype: string;
  discipline: string;
  week_start: string;
  dag_van_week: number;
  start_uur: number;
  duur_uren: number;
  plan_status: 'concept' | 'vast';
  is_hard_lock: boolean;
  // Mapping properties for compatibility with PlannerGrid
  employeeId: string;
  clientName: string;
  clientId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  planStatus: 'concept' | 'vast';
  projectTitel?: string;
  faseNaam?: string;
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

      // Map database rows to Task objects with compatibility fields
      return ((data || []) as any[]).map(row => {
        // Calculate the actual date for this task
        const taskDate = new Date(weekStartISO);
        taskDate.setDate(taskDate.getDate() + row.dag_van_week);
        const dateStr = taskDate.toISOString().split('T')[0];

        return {
          id: row.id,
          werknemer_naam: row.werknemer_naam,
          klant_naam: row.klant_naam,
          project_nummer: row.project_nummer,
          project_titel: row.project_titel,
          fase_naam: row.fase_naam,
          werktype: row.werktype,
          discipline: row.discipline,
          week_start: row.week_start,
          dag_van_week: row.dag_van_week,
          start_uur: row.start_uur,
          duur_uren: row.duur_uren,
          plan_status: row.plan_status || 'concept',
          is_hard_lock: row.is_hard_lock || false,
          // Compatibility fields for PlannerGrid
          employeeId: row.werknemer_naam,
          clientName: row.klant_naam,
          clientId: row.klant_naam,
          date: dateStr,
          startTime: `${row.start_uur.toString().padStart(2, '0')}:00`,
          endTime: `${(row.start_uur + row.duur_uren).toString().padStart(2, '0')}:00`,
          type: row.werktype || 'concept',
          planStatus: row.plan_status || 'concept',
          projectTitel: row.project_titel,
          faseNaam: row.fase_naam,
        } as Task;
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minuten
    enabled: !!weekStartISO, // Only run query if we have a week start
  });
}
