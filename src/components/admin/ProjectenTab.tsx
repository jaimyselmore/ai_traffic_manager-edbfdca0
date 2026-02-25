import { useMemo, useState } from 'react';
import { useActiveProjects, useAfgerondeProjecten } from '@/lib/data';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export function ProjectenTab() {
  const { data: activeProjects = [], isLoading: loadingActive } = useActiveProjects();
  const { data: completedProjects = [], isLoading: loadingCompleted } = useAfgerondeProjecten();
  const [search, setSearch] = useState('');

  const allProjects = useMemo(() => {
    const active = activeProjects.map(p => ({ ...p, statusLabel: 'Lopend' as const }));
    const completed = completedProjects.map(p => ({ ...p, statusLabel: 'Afgerond' as const }));
    return [...active, ...completed];
  }, [activeProjects, completedProjects]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return allProjects;
    return allProjects.filter(p =>
      (p.projectnummer || '').toLowerCase().includes(term) ||
      (p.klant_naam || '').toLowerCase().includes(term) ||
      (p.omschrijving || '').toLowerCase().includes(term)
    );
  }, [allProjects, search]);

  const isLoading = loadingActive || loadingCompleted;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Projecten</h2>
          <p className="text-sm text-muted-foreground">
            Overzicht van alle lopende en afgeronde projecten.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <Input
            placeholder="Zoek op klant, projectnummer of omschrijving..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Projecten worden geladen...</div>
      ) : filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">
          Geen projecten gevonden.
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[140px]">Projectnummer</TableHead>
                <TableHead>Klant</TableHead>
                <TableHead>Omschrijving</TableHead>
                <TableHead className="w-[140px]">Deadline</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium">{project.projectnummer}</TableCell>
                  <TableCell>{project.klant_naam}</TableCell>
                  <TableCell className="max-w-md">
                    <span className="line-clamp-2 text-sm text-muted-foreground">
                      {project.omschrijving}
                    </span>
                  </TableCell>
                  <TableCell>
                    {project.deadline
                      ? new Date(project.deadline).toLocaleDateString('nl-NL')
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={project.statusLabel === 'Lopend' ? 'default' : 'outline'}
                      className={
                        project.statusLabel === 'Lopend'
                          ? 'bg-emerald-500/10 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }
                    >
                      {project.statusLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

