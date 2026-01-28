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
  beschikbaarheid: string | null;
  notities: string | null;
};

const emptyForm = {
  klantnummer: '',
  naam: '',
  contactpersoon: '',
  email: '',
  telefoon: '',
  postcode: '',
  huisnummer: '',
  plaats: '',
  land: '',
  beschikbaarheid: '',
  notities: '',
};

// Helper to combine address fields into single string
const combineAddress = (postcode: string, huisnummer: string, plaats: string, land: string): string => {
  const parts: string[] = [];
  if (postcode || huisnummer) {
    parts.push([postcode, huisnummer].filter(Boolean).join(' '));
  }
  if (plaats) parts.push(plaats);
  if (land) parts.push(land);
  return parts.join(', ');
};

// Helper to parse address string back into components
const parseAddress = (adres: string | null): { postcode: string; huisnummer: string; plaats: string; land: string } => {
  if (!adres) return { postcode: '', huisnummer: '', plaats: '', land: '' };
  
  const parts = adres.split(', ').map(p => p.trim());
  if (parts.length === 0) return { postcode: '', huisnummer: '', plaats: '', land: '' };
  
  // Try to extract postcode and huisnummer from first part
  const firstPart = parts[0] || '';
  const postcodeMatch = firstPart.match(/^(\d{4}\s?[A-Z]{2})\s*(.*)$/i);
  
  let postcode = '';
  let huisnummer = '';
  
  if (postcodeMatch) {
    postcode = postcodeMatch[1] || '';
    huisnummer = postcodeMatch[2] || '';
  } else {
    // If no Dutch postcode pattern, just use the first part as-is
    const spaceParts = firstPart.split(' ');
    if (spaceParts.length >= 2) {
      postcode = spaceParts[0] || '';
      huisnummer = spaceParts.slice(1).join(' ');
    } else {
      postcode = firstPart;
    }
  }
  
  const plaats = parts[1] || '';
  const land = parts[2] || '';
  
  return { postcode, huisnummer, plaats, land };
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

  // Type for database operations (with combined adres field)
  type KlantDbData = {
    klantnummer: string;
    naam: string;
    contactpersoon: string;
    email: string;
    telefoon: string;
    adres: string;
    beschikbaarheid: string;
    notities: string;
  };

  const createMutation = useMutation({
    mutationFn: (data: KlantDbData) => createKlant(data, user?.id),
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
    mutationFn: ({ id, data }: { id: string; data: KlantDbData }) =>
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
    const parsed = parseAddress(item.adres);
    setForm({
      klantnummer: item.klantnummer,
      naam: item.naam,
      contactpersoon: item.contactpersoon || '',
      email: item.email || '',
      telefoon: item.telefoon || '',
      postcode: parsed.postcode,
      huisnummer: parsed.huisnummer,
      plaats: parsed.plaats,
      land: parsed.land,
      beschikbaarheid: item.beschikbaarheid || '',
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
    // Combine address fields into single adres string for database
    const formData = {
      klantnummer: form.klantnummer,
      naam: form.naam,
      contactpersoon: form.contactpersoon,
      email: form.email,
      telefoon: form.telefoon,
      adres: combineAddress(form.postcode, form.huisnummer, form.plaats, form.land),
      beschikbaarheid: form.beschikbaarheid,
      notities: form.notities,
    };
    
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
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
              <TableHead>Adres</TableHead>
              <TableHead>Beschikbaarheid</TableHead>
              <TableHead>Notities</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                  <TableCell className="max-w-[200px] truncate" title={k.adres || ''}>{k.adres || '-'}</TableCell>
                  <TableCell className="max-w-[150px] truncate" title={k.beschikbaarheid || ''}>{k.beschikbaarheid || '-'}</TableCell>
                  <TableCell className="max-w-[200px] truncate" title={k.notities || ''}>{k.notities || '-'}</TableCell>
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
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input
                  value={form.postcode}
                  onChange={(e) => setForm({ ...form, postcode: e.target.value })}
                  placeholder="1234 AB"
                />
              </div>
              <div className="space-y-2">
                <Label>Huisnummer</Label>
                <Input
                  value={form.huisnummer}
                  onChange={(e) => setForm({ ...form, huisnummer: e.target.value })}
                  placeholder="123a"
                />
              </div>
              <div className="space-y-2">
                <Label>Plaats</Label>
                <Input
                  value={form.plaats}
                  onChange={(e) => setForm({ ...form, plaats: e.target.value })}
                  placeholder="Amsterdam"
                />
              </div>
              <div className="space-y-2">
                <Label>Land</Label>
                <Input
                  value={form.land}
                  onChange={(e) => setForm({ ...form, land: e.target.value })}
                  placeholder="Nederland"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Beschikbaarheid</Label>
              <Input
                value={form.beschikbaarheid}
                onChange={(e) => setForm({ ...form, beschikbaarheid: e.target.value })}
                placeholder="bijv. Ma-Vr 09:00-17:00"
              />
              <p className="text-xs text-muted-foreground">
                Wanneer is de klant beschikbaar voor meetings/communicatie?
              </p>
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
