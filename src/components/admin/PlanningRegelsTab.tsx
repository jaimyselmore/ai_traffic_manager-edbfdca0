import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

export function PlanningRegelsTab() {
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EllenRegel | null>(null);
  const [deleteItem, setDeleteItem] = useState<EllenRegel | null>(null);
  const [form, setForm] = useState(emptyForm);

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

  const filtered = regels.filter((r: EllenRegel) =>
    r.regel.toLowerCase().includes(search.toLowerCase()) ||
    r.categorie.toLowerCase().includes(search.toLowerCase())
  );

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
    if (!form.regel.trim()) {
      toast.error('Regel is verplicht');
      return;
    }
    if (!form.categorie) {
      toast.error('Categorie is verplicht');
      return;
    }
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

  const getCategorieLabel = (cat: string) => {
    switch (cat) {
      case 'hard': return 'Hard (verplicht)';
      case 'soft': return 'Soft (belangrijk)';
      case 'voorkeur': return 'Voorkeur (optioneel)';
      default: return cat;
    }
  };

  const getCategorieColor = (cat: string) => {
    switch (cat) {
      case 'hard': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'soft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'voorkeur': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-4">
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
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Toevoegen
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Planningregels die Ellen gebruikt bij het maken van planningen.
        Hard = moet altijd, Soft = belangrijk maar kan afwijken, Voorkeur = nice to have.
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Prio</TableHead>
              <TableHead className="w-32">Categorie</TableHead>
              <TableHead>Regel</TableHead>
              <TableHead className="w-20">Actief</TableHead>
              <TableHead className="w-24"></TableHead>
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
                  Geen planningregels gevonden
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r: EllenRegel) => (
                <TableRow key={r.id} className={!r.actief ? 'opacity-50' : ''}>
                  <TableCell className="font-mono text-sm">{r.prioriteit ?? '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 text-xs rounded-full ${getCategorieColor(r.categorie)}`}>
                      {r.categorie}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{r.regel}</p>
                      {r.rationale && (
                        <p className="text-xs text-muted-foreground mt-0.5">{r.rationale}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={r.actief ? 'text-green-600' : 'text-muted-foreground'}>
                      {r.actief ? 'Ja' : 'Nee'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => confirmDelete(r)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Planningregel bewerken' : 'Nieuwe planningregel'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Regel *</Label>
              <Textarea
                value={form.regel}
                onChange={(e) => setForm({ ...form, regel: e.target.value })}
                placeholder="Beschrijf de planningregel..."
                rows={3}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Categorie *</Label>
                <Select
                  value={form.categorie}
                  onValueChange={(value) => setForm({ ...form, categorie: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIEEN.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {getCategorieLabel(cat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioriteit</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.prioriteit}
                  onChange={(e) => setForm({ ...form, prioriteit: e.target.value })}
                  placeholder="bijv. 1, 2, 3..."
                />
                <p className="text-xs text-muted-foreground">
                  Lager = belangrijker
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rationale / Toelichting</Label>
              <Textarea
                value={form.rationale}
                onChange={(e) => setForm({ ...form, rationale: e.target.value })}
                rows={2}
                placeholder="Waarom deze regel? (optioneel)"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="actief"
                checked={form.actief}
                onCheckedChange={(checked) => setForm({ ...form, actief: checked as boolean })}
              />
              <Label htmlFor="actief" className="cursor-pointer">
                Regel is actief
              </Label>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Annuleren
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingItem ? 'Opslaan' : 'Toevoegen'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Planningregel verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze regel wilt verwijderen?
              Dit kan niet ongedaan worden gemaakt.
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
