import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  getWerknemers,
  createWerknemer,
  updateWerknemer,
  deleteWerknemer,
} from '@/lib/data/adminService';

type Werknemer = {
  werknemer_id: number;
  naam_werknemer: string;
  email: string | null;
  primaire_rol: string | null;
  tweede_rol: string | null;
  derde_rol: string | null;
  discipline: string | null;
  werkuren: number | null;
  parttime_dag: string | null;
  duo_team: string | null;
  vaardigheden: string | null;
  notities: string | null;
  beschikbaar: boolean | null;
  is_planner: boolean | null;
};

const emptyForm = {
  naam_werknemer: '',
  email: '',
  primaire_rol: '',
  tweede_rol: '',
  derde_rol: '',
  discipline: '',
  werkuren: 40,
  parttime_dag: '',
  duo_team: '',
  vaardigheden: '',
  notities: '',
  beschikbaar: true,
  is_planner: false,
};

export function WerknemersTab() {
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Werknemer | null>(null);
  const [deleteItem, setDeleteItem] = useState<Werknemer | null>(null);
  const [form, setForm] = useState(emptyForm);

  const queryClient = useQueryClient();

  const { data: werknemers = [], isLoading } = useQuery({
    queryKey: ['werknemers'],
    queryFn: getWerknemers,
  });

  const createMutation = useMutation({
    mutationFn: createWerknemer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['werknemers'] });
      toast.success('Werknemer toegevoegd');
      closeDialog();
    },
    onError: () => toast.error('Fout bij toevoegen'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof form }) =>
      updateWerknemer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['werknemers'] });
      toast.success('Werknemer bijgewerkt');
      closeDialog();
    },
    onError: () => toast.error('Fout bij bijwerken'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWerknemer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['werknemers'] });
      toast.success('Werknemer verwijderd');
      setIsDeleteOpen(false);
      setDeleteItem(null);
    },
    onError: () => toast.error('Fout bij verwijderen'),
  });

  const filtered = werknemers.filter((w: Werknemer) =>
    w.naam_werknemer.toLowerCase().includes(search.toLowerCase()) ||
    w.email?.toLowerCase().includes(search.toLowerCase()) ||
    w.discipline?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (item: Werknemer) => {
    setEditingItem(item);
    setForm({
      naam_werknemer: item.naam_werknemer,
      email: item.email || '',
      primaire_rol: item.primaire_rol || '',
      tweede_rol: item.tweede_rol || '',
      derde_rol: item.derde_rol || '',
      discipline: item.discipline || '',
      werkuren: item.werkuren || 40,
      parttime_dag: item.parttime_dag || '',
      duo_team: item.duo_team || '',
      vaardigheden: item.vaardigheden || '',
      notities: item.notities || '',
      beschikbaar: item.beschikbaar ?? true,
      is_planner: item.is_planner ?? false,
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
    if (!form.naam_werknemer.trim()) {
      toast.error('Naam is verplicht');
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.werknemer_id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const confirmDelete = (item: Werknemer) => {
    setDeleteItem(item);
    setIsDeleteOpen(true);
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Naam</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Primaire rol</TableHead>
              <TableHead>Discipline</TableHead>
              <TableHead>Uren</TableHead>
              <TableHead>Beschikbaar</TableHead>
              <TableHead className="w-24">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Geen werknemers gevonden
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((w: Werknemer) => (
                <TableRow key={w.werknemer_id}>
                  <TableCell className="font-mono text-xs">{w.werknemer_id}</TableCell>
                  <TableCell className="font-medium">{w.naam_werknemer}</TableCell>
                  <TableCell>{w.email || '-'}</TableCell>
                  <TableCell>{w.primaire_rol || '-'}</TableCell>
                  <TableCell>{w.discipline || '-'}</TableCell>
                  <TableCell>{w.werkuren || 40}</TableCell>
                  <TableCell>{w.beschikbaar ? 'Ja' : 'Nee'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(w)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => confirmDelete(w)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? 'Werknemer bewerken' : 'Nieuwe werknemer'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Naam *</Label>
                <Input
                  value={form.naam_werknemer}
                  onChange={(e) => setForm({ ...form, naam_werknemer: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Primaire rol</Label>
                <Input
                  value={form.primaire_rol}
                  onChange={(e) => setForm({ ...form, primaire_rol: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tweede rol</Label>
                <Input
                  value={form.tweede_rol}
                  onChange={(e) => setForm({ ...form, tweede_rol: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Derde rol</Label>
                <Input
                  value={form.derde_rol}
                  onChange={(e) => setForm({ ...form, derde_rol: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Discipline</Label>
                <Input
                  value={form.discipline}
                  onChange={(e) => setForm({ ...form, discipline: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Werkuren per week</Label>
                <Input
                  type="number"
                  value={form.werkuren}
                  onChange={(e) => setForm({ ...form, werkuren: parseInt(e.target.value) || 40 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Parttime dag</Label>
                <Input
                  value={form.parttime_dag}
                  onChange={(e) => setForm({ ...form, parttime_dag: e.target.value })}
                  placeholder="bijv. vrijdag"
                />
              </div>
              <div className="space-y-2">
                <Label>Duo team</Label>
                <Input
                  value={form.duo_team}
                  onChange={(e) => setForm({ ...form, duo_team: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vaardigheden</Label>
                <Input
                  value={form.vaardigheden}
                  onChange={(e) => setForm({ ...form, vaardigheden: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notities</Label>
              <Input
                value={form.notities}
                onChange={(e) => setForm({ ...form, notities: e.target.value })}
              />
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.beschikbaar}
                  onCheckedChange={(checked) => setForm({ ...form, beschikbaar: checked })}
                />
                <Label>Beschikbaar</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.is_planner}
                  onCheckedChange={(checked) => setForm({ ...form, is_planner: checked })}
                />
                <Label>Is planner</Label>
              </div>
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
            <AlertDialogTitle>Werknemer verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{deleteItem?.naam_werknemer}" wilt verwijderen? 
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.werknemer_id)}
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
