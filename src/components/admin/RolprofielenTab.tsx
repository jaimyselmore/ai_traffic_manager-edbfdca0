import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  getRolprofielen,
  createRolprofiel,
  updateRolprofiel,
  deleteRolprofiel,
} from '@/lib/data/adminService';

type Rolprofiel = {
  rol_nummer: number;
  rol_naam: string;
  beschrijving_rol: string | null;
  taken_rol: string | null;
};

const emptyForm = {
  rol_naam: '',
  beschrijving_rol: '',
  taken_rol: '',
};

export function RolprofielenTab() {
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Rolprofiel | null>(null);
  const [deleteItem, setDeleteItem] = useState<Rolprofiel | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: rollen = [], isLoading } = useQuery({
    queryKey: ['rolprofielen'],
    queryFn: getRolprofielen,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => createRolprofiel(data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolprofielen'] });
      toast.success('Rol toegevoegd');
      closeDialog();
    },
    onError: () => toast.error('Fout bij toevoegen'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof form }) =>
      updateRolprofiel(id, data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolprofielen'] });
      toast.success('Rol bijgewerkt');
      closeDialog();
    },
    onError: () => toast.error('Fout bij bijwerken'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteRolprofiel(id, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rolprofielen'] });
      toast.success('Rol verwijderd');
      setIsDeleteOpen(false);
      setDeleteItem(null);
    },
    onError: () => toast.error('Fout bij verwijderen'),
  });

  const filtered = rollen.filter((r: Rolprofiel) =>
    r.rol_naam.toLowerCase().includes(search.toLowerCase()) ||
    r.beschrijving_rol?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (item: Rolprofiel) => {
    setEditingItem(item);
    setForm({
      rol_naam: item.rol_naam,
      beschrijving_rol: item.beschrijving_rol || '',
      taken_rol: item.taken_rol || '',
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
    if (!form.rol_naam.trim()) {
      toast.error('Rol naam is verplicht');
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.rol_nummer, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const confirmDelete = (item: Rolprofiel) => {
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
              <TableHead className="w-20">#</TableHead>
              <TableHead>Rol naam</TableHead>
              <TableHead>Beschrijving</TableHead>
              <TableHead>Taken</TableHead>
              <TableHead className="w-24">Acties</TableHead>
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
                  Geen rollen gevonden
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r: Rolprofiel) => (
                <TableRow key={r.rol_nummer}>
                  <TableCell className="font-mono text-xs">{r.rol_nummer}</TableCell>
                  <TableCell className="font-medium">{r.rol_naam}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.beschrijving_rol || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate">{r.taken_rol || '-'}</TableCell>
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
              {editingItem ? 'Rol bewerken' : 'Nieuwe rol'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Rol naam *</Label>
              <Input
                value={form.rol_naam}
                onChange={(e) => setForm({ ...form, rol_naam: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Beschrijving</Label>
              <Textarea
                value={form.beschrijving_rol}
                onChange={(e) => setForm({ ...form, beschrijving_rol: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Taken</Label>
              <Textarea
                value={form.taken_rol}
                onChange={(e) => setForm({ ...form, taken_rol: e.target.value })}
                rows={3}
              />
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
            <AlertDialogTitle>Rol verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{deleteItem?.rol_naam}" wilt verwijderen? 
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.rol_nummer)}
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
