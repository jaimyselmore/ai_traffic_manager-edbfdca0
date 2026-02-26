import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
      {/* Search bar - same style as KlantenTab */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoeken..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
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
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Geen projecten gevonden.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((project) => (
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
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
