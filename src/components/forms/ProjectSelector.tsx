import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects, Project } from '@/hooks/use-projects';
import { Loader2 } from 'lucide-react';

export interface ProjectSelectorData {
  projectId: string;
  projectTitel: string;
  projectNummer: string;
  klantId: string;
  klantNaam: string;
  omschrijving: string;
}

interface ProjectSelectorProps {
  value?: string; // projectId
  onChange: (data: ProjectSelectorData | null) => void;
  error?: string;
  label?: string;
  placeholder?: string;
  filterStatus?: 'concept' | 'vast' | 'afgerond';
}

export function ProjectSelector({
  value,
  onChange,
  error,
  label = 'Selecteer project *',
  placeholder = 'Kies een bestaand project',
  filterStatus,
}: ProjectSelectorProps) {
  const { data: projects = [], isLoading } = useProjects(filterStatus);

  const handleProjectChange = (projectId: string) => {
    const selectedProject = projects.find(p => p.id === projectId);

    if (!selectedProject) {
      onChange(null);
      return;
    }

    // Extract project data
    const projectData: ProjectSelectorData = {
      projectId: selectedProject.id,
      projectTitel: selectedProject.titel || '',
      projectNummer: selectedProject.projectnummer,
      klantId: selectedProject.klant_id,
      klantNaam: selectedProject.klanten?.naam || '',
      omschrijving: selectedProject.omschrijving,
    };

    onChange(projectData);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Project Selectie</h2>

      <div className="space-y-2">
        <Label className="text-sm">{label}</Label>
        <Select
          value={value}
          onValueChange={handleProjectChange}
          disabled={isLoading}
        >
          <SelectTrigger className={error ? 'border-destructive' : ''}>
            <SelectValue placeholder={isLoading ? 'Laden...' : placeholder} />
          </SelectTrigger>
          <SelectContent>
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && projects.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                Geen projecten gevonden
              </div>
            )}
            {!isLoading && projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {project.titel || `${project.klanten?.naam} - ${project.projectnummer}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {project.omschrijving.substring(0, 50)}
                    {project.omschrijving.length > 50 ? '...' : ''}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Selecteer een bestaand project om aan deze activiteit te koppelen.
        </p>
      </div>

      {/* Show selected project info */}
      {value && projects.length > 0 && (
        <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-sm text-muted-foreground">
            Geselecteerd project:{' '}
            <span className="font-semibold text-foreground">
              {projects.find(p => p.id === value)?.titel ||
               `${projects.find(p => p.id === value)?.klanten?.naam} - ${projects.find(p => p.id === value)?.projectnummer}`}
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Deze titel wordt gebruikt in de planner.
          </p>
        </div>
      )}
    </div>
  );
}

export const emptyProjectSelectorData: ProjectSelectorData = {
  projectId: '',
  projectTitel: '',
  projectNummer: '',
  klantId: '',
  klantNaam: '',
  omschrijving: '',
};
