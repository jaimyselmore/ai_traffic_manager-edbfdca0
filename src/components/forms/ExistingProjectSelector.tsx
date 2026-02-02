import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useProjects } from '@/lib/data';

export interface ExistingProjectData {
  projectId: string;
  projectnummer: string;
  projectTitel?: string;
  klantNaam: string;
  omschrijving: string;
}

interface ExistingProjectSelectorProps {
  value: string;
  onChange: (data: ExistingProjectData | null) => void;
  error?: string;
}

export function ExistingProjectSelector({ value, onChange, error }: ExistingProjectSelectorProps) {
  const { data: projects = [], isLoading } = useProjects();

  const handleProjectChange = (projectId: string) => {
    const selectedProject = projects.find(p => p.id === projectId);
    if (selectedProject) {
      onChange({
        projectId: selectedProject.id,
        projectnummer: selectedProject.projectnummer,
        projectTitel: selectedProject.titel,
        klantNaam: selectedProject.klant_naam || 'Onbekende klant',
        omschrijving: selectedProject.omschrijving,
      });
    } else {
      onChange(null);
    }
  };

  const selectedProject = projects.find(p => p.id === value);

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Project koppeling *</h2>
      <p className="text-sm text-muted-foreground">
        Selecteer het bestaande project waarvoor je een wijziging wilt aanvragen.
      </p>

      <div className="space-y-2">
        <Select
          value={value}
          onValueChange={handleProjectChange}
          disabled={isLoading || projects.length === 0}
        >
          <SelectTrigger className={error ? 'border-destructive' : ''}>
            <SelectValue placeholder={
              isLoading
                ? "Laden..."
                : projects.length === 0
                  ? "Geen projecten beschikbaar"
                  : "Selecteer een project"
            } />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.titel ? (
                  <>
                    <span className="font-medium">{project.titel}</span>
                    <span className="text-muted-foreground text-xs ml-2">({project.klant_naam})</span>
                  </>
                ) : (
                  <>
                    <span className="font-mono text-xs mr-2">{project.projectnummer}</span>
                    <span>{project.klant_naam} - {project.omschrijving}</span>
                  </>
                )}
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
      </div>

      {/* Show selected project info */}
      {selectedProject && (
        <div className="p-3 bg-secondary/50 rounded-lg space-y-1">
          {selectedProject.titel && (
            <p className="text-sm">
              <span className="text-muted-foreground">Titel:</span>{' '}
              <span className="font-medium text-foreground">{selectedProject.titel}</span>
            </p>
          )}
          <p className="text-sm">
            <span className="text-muted-foreground">Projectnummer:</span>{' '}
            <span className="font-mono font-medium text-foreground">{selectedProject.projectnummer}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Klant:</span>{' '}
            <span className="font-medium text-foreground">{selectedProject.klant_naam}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Omschrijving:</span>{' '}
            <span className="text-foreground">{selectedProject.omschrijving}</span>
          </p>
          <p className="text-sm">
            <span className="text-muted-foreground">Type:</span>{' '}
            <span className="text-foreground">{selectedProject.projecttype}</span>
          </p>
          {selectedProject.deadline && (
            <p className="text-sm">
              <span className="text-muted-foreground">Deadline:</span>{' '}
              <span className="text-foreground">{new Date(selectedProject.deadline).toLocaleDateString('nl-NL')}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
