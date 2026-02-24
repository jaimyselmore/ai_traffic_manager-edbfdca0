import { useQuery } from '@tanstack/react-query';
import { secureSelect } from '@/lib/data/secureDataClient';

// Task interface matching what Planner expects
export interface Task {
  id: string;
  project_id: string | null;
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
  plan_status: 'concept' | 'vast' | 'wacht_klant';
  is_hard_lock: boolean;
  // Mapping properties for compatibility with PlannerGrid
  employeeId: string;
  clientName: string;
  clientId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  planStatus: 'concept' | 'vast' | 'wacht_klant';
  projectTitel?: string;
  faseNaam?: string;
}

export function useTasks(weekStart: Date, employeeName?: string) {
  // Use local date to avoid timezone shift (toISOString converts to UTC which can shift the day)
  const weekStartISO = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`;

  return useQuery({
    queryKey: ['tasks', weekStartISO, employeeName],
    queryFn: async () => {
      const filters: Array<{ column: string; operator: 'eq'; value: string }> = [
        { column: 'week_start', operator: 'eq', value: weekStartISO },
      ];

      if (employeeName) {
        filters.push({ column: 'werknemer_naam', operator: 'eq', value: employeeName });
      }

      const { data, error } = await secureSelect<any>('taken', {
        filters,
        order: { column: 'dag_van_week', ascending: true },
      });

      if (error) {
        throw new Error(`Fout bij ophalen taken: ${error.message}`);
      }

      // Map database rows to Task objects with compatibility fields
      return ((data || []) as any[]).map(row => {
        // Calculate the actual date for this task
        const taskDate = new Date(weekStartISO + 'T00:00:00');
        taskDate.setDate(taskDate.getDate() + row.dag_van_week);
        const dateStr = `${taskDate.getFullYear()}-${String(taskDate.getMonth() + 1).padStart(2, '0')}-${String(taskDate.getDate()).padStart(2, '0')}`;

        return {
          id: row.id,
          project_id: row.project_id || null,
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
    staleTime: 5 * 60 * 1000,
    enabled: !!weekStartISO,
  });
}
