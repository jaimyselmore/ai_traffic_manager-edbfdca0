import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  getEllenRegels,
  createEllenRegel,
  updateEllenRegel,
  deleteEllenRegel,
} from '@/lib/data/adminService';

type EllenRegel = {
  id: string;
  regel: string;
  categorie: string;
  prioriteit: number | null;
  actief: boolean | null;
  rationale: string | null;
  created_at: string | null;
};

const CATEGORIEEN = ['hard', 'soft', 'voorkeur'];

const emptyForm = {
  regel: '',
  categorie: 'soft',
  prioriteit: '',
  actief: true,
  rationale: '',
};

const categorieConfig = {
  hard: {
    label: 'Hard',
    description: 'Verplichte regels — nooit overrulen',
    badgeClass: 'bg-red-50 text-red-700 border border-red-200',
    dotClass: 'bg-red-500',
    headerClass: 'text-red-700',
    order: 0,
  },
  soft: {
    label: 'Soft',
    description: 'Sterk aanbevolen — alleen negeren met reden',
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    dotClass: 'bg-amber-500',
    headerClass: 'text-amber-700',
    order: 1,
  },
  voorkeur: {
    label: 'Voorkeur',
    description: 'Optioneel — gebruik als het past',
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    dotClass: 'bg-blue-500',
    headerClass: 'text-blue-700',
    order: 2,
  },
} as const;

export function PlanningRegelsTab() {
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EllenRegel | null>(null);
  const [deleteItem, setDeleteItem] = useState<EllenRegel | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: regels = [], isLoading } = useQuery({
    queryKey: ['ellen_regels'],
    queryFn: getEllenRegels,
  });

  type RegelDbData = {
    regel: string;
    categorie: string;
    prioriteit?: number;
    actief: boolean;
    rationale?: string;
  };

  const createMutation = useMutation({
    mutationFn: (data: RegelDbData) => createEllenRegel(data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ellen_regels'] });
      toast.success('Planningregel toegevoegd');
      closeDialog();
    },
    onError: () => toast.error('Fout bij toevoegen'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: RegelDbData }) =>
      updateEllenRegel(id, data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ellen_regels'] });
      toast.success('Planningregel bijgewerkt');
      closeDialog();
    },
    onError: () => toast.error('Fout bij bijwerken'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEllenRegel(id, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ellen_regels'] });
      toast.success('Planningregel verwijderd');
      setIsDeleteOpen(false);
      setDeleteItem(null);
    },
    onError: () => toast.error('Fout bij verwijderen'),
  });

  const filtered = (regels as EllenRegel[])
    .filter((r) =>
      r.regel.toLowerCase().includes(search.toLowerCase()) ||
      r.categorie.toLowerCase().includes(search.toLowerCase()) ||
      (r.rationale ?? '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => (a.prioriteit ?? 999) - (b.prioriteit ?? 999));

  const grouped = CATEGORIEEN.map((cat) => ({
    cat,
    items: filtered.filter((r) => r.categorie === cat),
  })).filter((g) => g.items.length > 0 || !search);

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (item: EllenRegel) => {
    setEditingItem(item);
    setForm({
      regel: item.regel,
      categorie: item.categorie,
      prioriteit: item.prioriteit?.toString() || '',
      actief: item.actief ?? true,
      rationale: item.rationale || '',
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingItem(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.regel.trim()) { toast.error('Regel is verplicht'); return; }
    if (!form.categorie) { toast.error('Categorie is verplicht'); return; }
    const formData: RegelDbData = {
      regel: form.regel,
      categorie: form.categorie,
      prioriteit: form.prioriteit ? parseInt(form.prioriteit, 10) : undefined,
      actief: form.actief,
      rationale: form.rationale || undefined,
    };
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const confirmDelete = (item: EllenRegel) => {
    setDeleteItem(item);
    setIsDeleteOpen(true);
  };

  const toggleCollapse = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getCategorieLabel = (cat: string) => {
    switch (cat) {
      case 'hard': return 'Hard (verplicht)';
      case 'soft': return 'Soft (belangrijk)';
      case 'voorkeur': return 'Voorkeur (optioneel)';
      default: return cat;
    }
  };

  const totalActive = (regels as EllenRegel[]).filter(r => r.actief).length;

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Zoeken in regels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{totalActive} actieve regels</span>
          <Button size="sm" onClick={openCreate} className="h-8 text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Regel toevoegen
          </Button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Laden...</div>
      ) : (
        <div className="space-y-3">
          {CATEGORIEEN.map((cat) => {
            const config = categorieConfig[cat as keyof typeof categorieConfig];
            const items = filtered.filter((r) => r.categorie === cat);
            const isCollapsed = collapsed[cat];

            return (
              <div key={cat} className="rounded-lg border border-border overflow-hidden">
                {/* Category header */}
                <button
                  onClick={() => toggleCollapse(cat)}
                  className="flex items-center w-full px-4 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className={cn('w-2 h-2 rounded-full mr-2.5 flex-shrink-0', config.dotClass)} />
                  <span className={cn('text-xs font-semibold', config.headerClass)}>{config.label}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{config.description}</span>
                  <span className="ml-auto mr-2 text-xs font-medium text-muted-foreground">{items.length}</span>
                  {isCollapsed
                    ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                </button>

                {/* Rows */}
                {!isCollapsed && (
                  <div className="divide-y divide-border">
                    {items.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground italic">
                        Geen regels in deze categorie
                      </div>
                    ) : (
                      items.map((r) => (
                        <div
                          key={r.id}
                          className={cn(
                            'flex items-start gap-3 px-4 py-2.5 group hover:bg-muted/20 transition-colors',
                            !r.actief && 'opacity-40'
                          )}
                        >
                          {/* Prio */}
                          <span className="w-5 flex-shrink-0 text-xs font-mono text-muted-foreground mt-0.5 text-right">
                            {r.prioriteit ?? '—'}
                          </span>

                          {/* Regel tekst */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground leading-snug">{r.regel}</p>
                            {r.rationale && (
                              <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{r.rationale}</p>
                            )}
                          </div>

                          {/* Status */}
                          {!r.actief && (
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5">
                              inactief
                            </span>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <button
                              onClick={() => openEdit(r)}
                              className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => confirmDelete(r)}
                              className="flex items-center justify-center h-6 w-6 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Create dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editingItem ? 'Planningregel bewerken' : 'Nieuwe planningregel'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Regel *</Label>
              <Textarea
                value={form.regel}
                onChange={(e) => setForm({ ...form, regel: e.target.value })}
                placeholder="Beschrijf de planningregel..."
                rows={3}
                className="text-sm resize-none"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Categorie *</Label>
                <Select
                  value={form.categorie}
                  onValueChange={(value) => setForm({ ...form, categorie: value })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecteer categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIEEN.map((cat) => (
                      <SelectItem key={cat} value={cat} className="text-sm">
                        {getCategorieLabel(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Prioriteit</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.prioriteit}
                  onChange={(e) => setForm({ ...form, prioriteit: e.target.value })}
                  placeholder="1, 2, 3..."
                  className="h-8 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">Lager = eerder toegepast</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Toelichting</Label>
              <Textarea
                value={form.rationale}
                onChange={(e) => setForm({ ...form, rationale: e.target.value })}
                rows={2}
                placeholder="Waarom deze regel? (optioneel)"
                className="text-sm resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="actief"
                checked={form.actief}
                onCheckedChange={(checked) => setForm({ ...form, actief: checked as boolean })}
              />
              <Label htmlFor="actief" className="text-xs cursor-pointer">
                Regel is actief
              </Label>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button type="button" variant="outline" size="sm" onClick={closeDialog}>
                Annuleren
              </Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingItem ? 'Opslaan' : 'Toevoegen'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planningregel verwijderen?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Weet je zeker dat je deze regel wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
