import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects } from '@/hooks/use-projects';

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
  placeholder?: string;
  filterStatus?: 'concept' | 'vast' | 'afgerond';
}

export function ProjectSelector({
  value,
  onChange,
  error,
  placeholder = 'Selecteer een project',
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
    <div className="space-y-2">
      <Select
        value={value}
        onValueChange={handleProjectChange}
        disabled={isLoading || projects.length === 0}
      >
        <SelectTrigger className={error ? 'border-destructive' : ''}>
          <SelectValue placeholder={
            isLoading
              ? 'Laden...'
              : projects.length === 0
                ? 'Geen projecten beschikbaar'
                : placeholder
          } />
        </SelectTrigger>
        <SelectContent>
          {projects.map((project) => (
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
      {projects.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground">
          Er zijn nog geen projecten aangemaakt. Maak eerst een project aan via "Nieuw Project".
        </p>
      )}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Show selected project info */}
      {value && projects.length > 0 && (
        <div className="p-3 bg-secondary/50 rounded-lg space-y-1">
          <p className="text-sm">
            <span className="text-muted-foreground">Geselecteerd project:</span>{' '}
            <span className="font-medium text-foreground">
              {projects.find(p => p.id === value)?.titel ||
               `${projects.find(p => p.id === value)?.klanten?.naam} - ${projects.find(p => p.id === value)?.projectnummer}`}
            </span>
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
