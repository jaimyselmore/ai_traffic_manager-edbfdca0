import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTaak, deleteTaak } from '@/lib/data/takenService';
import { secureDelete, secureUpdate } from '@/lib/data/secureDataClient';
import { toast } from '@/hooks/use-toast';

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      return updateTaak(id, updates as any, '', '');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Taak bijgewerkt', description: 'De wijziging is opgeslagen.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij opslaan', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return deleteTaak(id, '', '');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Taak verwijderd', description: 'De taak is uit de planner gehaald.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteProjectTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      // Eerst alle taken verwijderen
      const { error: takenError } = await secureDelete('taken', [
        { column: 'project_id', operator: 'eq', value: projectId },
      ]);
      if (takenError) throw takenError;

      // Dan het project zelf verwijderen
      const { error: projectError } = await secureDelete('projecten', [
        { column: 'id', operator: 'eq', value: projectId },
      ]);
      if (projectError) throw projectError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['data'] });
      toast({ title: 'Project verwijderd', description: 'Het project en alle taken zijn verwijderd.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteVerlofTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ werknemer_naam, werktype }: { werknemer_naam: string; werktype: string }) => {
      // Delete all taken records for this employee + werktype
      const { error } = await secureDelete('taken', [
        { column: 'werknemer_naam', operator: 'eq', value: werknemer_naam },
        { column: 'werktype', operator: 'eq', value: werktype },
      ]);
      if (error) throw error;

      // Also remove from beschikbaarheid_medewerkers
      await secureDelete('beschikbaarheid_medewerkers', [
        { column: 'werknemer_naam', operator: 'eq', value: werknemer_naam },
        { column: 'type', operator: 'eq', value: werktype },
      ]);
    },
    onSuccess: (_, { werktype }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({
        title: werktype === 'ziek' ? 'Ziekmelding verwijderd' : 'Verlof verwijderd',
        description: 'De volledige periode is verwijderd uit de planner.',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij verwijderen', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCompleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const { error } = await secureUpdate('projecten',
        {
          status: 'afgerond',
          afgerond_op: new Date().toISOString(),
        },
        [{ column: 'id', operator: 'eq', value: projectId }]
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['data'] });
      toast({ title: 'Project afgerond', description: 'Het project is gemarkeerd als afgerond.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Fout bij afronden', description: error.message, variant: 'destructive' });
    },
  });
}
