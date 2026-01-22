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
  getKlanten,
  createKlant,
  updateKlant,
  deleteKlant,
} from '@/lib/data/adminService';

type Klant = {
  id: string;
  klantnummer: string;
  naam: string;
  contactpersoon: string | null;
  email: string | null;
  telefoon: string | null;
  adres: string | null;
  notities: string | null;
};

const emptyForm = {
  klantnummer: '',
  naam: '',
  contactpersoon: '',
  email: '',
  telefoon: '',
  adres: '',
  notities: '',
};

export function KlantenTab() {
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Klant | null>(null);
  const [deleteItem, setDeleteItem] = useState<Klant | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: klanten = [], isLoading } = useQuery({
    queryKey: ['klanten'],
    queryFn: getKlanten,
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => createKlant(data, user?.id),
    onSuccess: () => {
      // Invalidate both query keys to sync all dropdowns
      queryClient.invalidateQueries({ queryKey: ['klanten'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Klant toegevoegd');
      closeDialog();
    },
    onError: () => toast.error('Fout bij toevoegen'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof form }) =>
      updateKlant(id, data, user?.id),
    onSuccess: () => {
      // Invalidate both query keys to sync all dropdowns
      queryClient.invalidateQueries({ queryKey: ['klanten'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Klant bijgewerkt');
      closeDialog();
    },
    onError: () => toast.error('Fout bij bijwerken'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKlant(id, user?.id),
    onSuccess: () => {
      // Invalidate both query keys to sync all dropdowns
      queryClient.invalidateQueries({ queryKey: ['klanten'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Klant verwijderd');
      setIsDeleteOpen(false);
      setDeleteItem(null);
    },
    onError: () => toast.error('Fout bij verwijderen'),
  });

  const filtered = klanten.filter((k: Klant) =>
    k.naam.toLowerCase().includes(search.toLowerCase()) ||
    k.klantnummer.toLowerCase().includes(search.toLowerCase()) ||
    k.contactpersoon?.toLowerCase().includes(search.toLowerCase()) ||
    k.email?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (item: Klant) => {
    setEditingItem(item);
    setForm({
      klantnummer: item.klantnummer,
      naam: item.naam,
      contactpersoon: item.contactpersoon || '',
      email: item.email || '',
      telefoon: item.telefoon || '',
      adres: item.adres || '',
      notities: item.notities || '',
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
    if (!form.klantnummer.trim()) {
      toast.error('Klantnummer is verplicht');
      return;
    }
    if (!form.naam.trim()) {
      toast.error('Naam is verplicht');
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const confirmDelete = (item: Klant) => {
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
              <TableHead className="w-24">Klantnr</TableHead>
              <TableHead>Naam</TableHead>
              <TableHead>Contactpersoon</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Telefoon</TableHead>
              <TableHead className="w-24">Acties</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Geen klanten gevonden
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((k: Klant) => (
                <TableRow key={k.id}>
                  <TableCell className="font-mono text-xs">{k.klantnummer}</TableCell>
                  <TableCell className="font-medium">{k.naam}</TableCell>
                  <TableCell>{k.contactpersoon || '-'}</TableCell>
                  <TableCell>{k.email || '-'}</TableCell>
                  <TableCell>{k.telefoon || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(k)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => confirmDelete(k)}>
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
              {editingItem ? 'Klant bewerken' : 'Nieuwe klant'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Klantnummer *</Label>
                <Input
                  value={form.klantnummer}
                  onChange={(e) => setForm({ ...form, klantnummer: e.target.value })}
                  placeholder="bijv. K001 of ABC123"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Naam *</Label>
                <Input
                  value={form.naam}
                  onChange={(e) => setForm({ ...form, naam: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Contactpersoon</Label>
                <Input
                  value={form.contactpersoon}
                  onChange={(e) => setForm({ ...form, contactpersoon: e.target.value })}
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
              <div className="space-y-2 col-span-2">
                <Label>Telefoon</Label>
                <Input
                  value={form.telefoon}
                  onChange={(e) => setForm({ ...form, telefoon: e.target.value })}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Adres</Label>
                <Input
                  value={form.adres}
                  onChange={(e) => setForm({ ...form, adres: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notities</Label>
              <Textarea
                value={form.notities}
                onChange={(e) => setForm({ ...form, notities: e.target.value })}
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
            <AlertDialogTitle>Klant verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{deleteItem?.naam}" wilt verwijderen? 
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
