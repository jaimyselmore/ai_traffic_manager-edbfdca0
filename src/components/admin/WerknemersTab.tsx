import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useAuth } from '@/contexts/AuthContext';
import {
  getMedewerkers,
  createMedewerker,
  updateMedewerker,
  deleteMedewerker,
  getRolprofielen,
} from '@/lib/data/adminService';
import { deriveDisciplinesFromRoles } from '@/lib/helpers/roleDisciplineMapping';

type Medewerker = {
  werknemer_id: number;
  naam_werknemer: string;
  email: string | null;
  gebruikersnaam?: string | null;
  primaire_rol: string | null;
  tweede_rol: string | null;
  derde_rol: string | null;
  discipline: string | null;
  discipline_2: string | null;
  discipline_3: string | null;
  werkuren: number | null;
  parttime_dag: string | null;
  duo_team: string | null;
  vaardigheden: string | null;
  notities: string | null;
  beschikbaar: boolean | null;
  is_planner: boolean | null;
  display_order: number | null;
};

const emptyForm = {
  naam_werknemer: '',
  email: '',
  gebruikersnaam: '',
  primaire_rol: '',
  tweede_rol: '',
  derde_rol: '',
  discipline: '',
  discipline_2: '',
  discipline_3: '',
  werkuren: 40,
  parttime_dag: '',
  duo_team: '',
  vaardigheden: '',
  notities: '',
  beschikbaar: true,
  is_planner: false,
  display_order: 0,
};

export function MedewerkersTab() {
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Medewerker | null>(null);
  const [deleteItem, setDeleteItem] = useState<Medewerker | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: medewerkers = [], isLoading } = useQuery({
    queryKey: ['medewerkers'],
    queryFn: getMedewerkers,
  });

  // Fetch roles dynamically from database
  const { data: rolprofielen = [] } = useQuery({
    queryKey: ['rolprofielen'],
    queryFn: getRolprofielen,
  });

  // Build dynamic role-to-discipline mapping from database
  const roleDisciplineMap: Record<string, string> = {};
  const availableRoles: string[] = [];

  rolprofielen.forEach((rol) => {
    availableRoles.push(rol.rol_naam);
    if (rol.standaard_discipline) {
      roleDisciplineMap[rol.rol_naam] = rol.standaard_discipline;
    }
  });

  // Auto-calculate disciplines when roles change
  useEffect(() => {
    const disciplines: string[] = [];

    // Add disciplines for each role (skip duplicates and roles without discipline)
    if (form.primaire_rol && form.primaire_rol !== 'Stagiair' && roleDisciplineMap[form.primaire_rol]) {
      disciplines.push(roleDisciplineMap[form.primaire_rol]);
    }

    if (form.tweede_rol && form.tweede_rol !== 'Stagiair' && roleDisciplineMap[form.tweede_rol]) {
      const disc = roleDisciplineMap[form.tweede_rol];
      if (!disciplines.includes(disc)) {
        disciplines.push(disc);
      }
    }

    if (form.derde_rol && form.derde_rol !== 'Stagiair' && roleDisciplineMap[form.derde_rol]) {
      const disc = roleDisciplineMap[form.derde_rol];
      if (!disciplines.includes(disc)) {
        disciplines.push(disc);
      }
    }

    setForm(prev => ({
      ...prev,
      discipline: disciplines[0] || '',
      discipline_2: disciplines[1] || '',
      discipline_3: disciplines[2] || '',
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.primaire_rol, form.tweede_rol, form.derde_rol, JSON.stringify(roleDisciplineMap)]);

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => createMedewerker(data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medewerkers'] });
      toast.success(
        form.is_planner
          ? 'Medewerker en gebruikersaccount succesvol aangemaakt'
          : 'Medewerker succesvol toegevoegd'
      );
      closeDialog();
    },
    onError: (error: Error) => {
      if (error.message.includes('gebruikersnaam is al in gebruik')) {
        toast.error('Deze gebruikersnaam bestaat al. Kies een andere.', { duration: 5000 });
      } else if (error.message.includes('gebruikersaccount kon niet worden gemaakt')) {
        toast.error(error.message, { duration: 6000 });
      } else {
        toast.error('Fout bij toevoegen medewerker: ' + error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof form }) =>
      updateMedewerker(id, data, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medewerkers'] });
      toast.success(
        form.is_planner && !editingItem?.is_planner
          ? 'Medewerker bijgewerkt en gebruikersaccount aangemaakt'
          : 'Medewerker bijgewerkt'
      );
      closeDialog();
    },
    onError: (error: Error) => {
      if (error.message.includes('gebruikersnaam is al in gebruik')) {
        toast.error('Deze gebruikersnaam bestaat al. Kies een andere.', { duration: 5000 });
      } else if (error.message.includes('gebruikersaccount kon niet worden gemaakt')) {
        toast.error(error.message, { duration: 6000 });
      } else {
        toast.error('Fout bij bijwerken medewerker: ' + error.message);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMedewerker(id, user?.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medewerkers'] });
      toast.success('Medewerker verwijderd');
      setIsDeleteOpen(false);
      setDeleteItem(null);
    },
    onError: () => toast.error('Fout bij verwijderen'),
  });

  const filtered = medewerkers.filter((w: Medewerker) =>
    w.naam_werknemer.toLowerCase().includes(search.toLowerCase()) ||
    w.email?.toLowerCase().includes(search.toLowerCase()) ||
    w.discipline?.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setIsDialogOpen(true);
  };

  const openEdit = (item: Medewerker) => {
    setEditingItem(item);
    setForm({
      naam_werknemer: item.naam_werknemer,
      email: item.email || '',
      gebruikersnaam: item.gebruikersnaam || '',
      primaire_rol: item.primaire_rol || '',
      tweede_rol: item.tweede_rol || '',
      derde_rol: item.derde_rol || '',
      discipline: item.discipline || '',
      discipline_2: item.discipline_2 || '',
      discipline_3: item.discipline_3 || '',
      werkuren: item.werkuren || 40,
      parttime_dag: item.parttime_dag || '',
      duo_team: item.duo_team || '',
      vaardigheden: item.vaardigheden || '',
      notities: item.notities || '',
      beschikbaar: item.beschikbaar ?? true,
      is_planner: item.is_planner ?? false,
      display_order: item.display_order || 0,
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

    // Validatie voor planner accounts
    if (form.is_planner) {
      if (!form.gebruikersnaam.trim()) {
        toast.error('Gebruikersnaam is verplicht voor planners');
        return;
      }

      if (form.gebruikersnaam.trim().length < 3) {
        toast.error('Gebruikersnaam moet minimaal 3 tekens zijn');
        return;
      }
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.werknemer_id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const confirmDelete = (item: Medewerker) => {
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
              <TableHead className="w-20">Volgorde</TableHead>
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
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Laden...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Geen medewerkers gevonden
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((w: Medewerker) => (
                <TableRow key={w.werknemer_id}>
                  <TableCell className="font-semibold text-primary">{w.display_order || '-'}</TableCell>
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
              {editingItem ? 'Medewerker bewerken' : 'Nieuwe medewerker'}
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
                <Label>Volgorde in planner</Label>
                <Input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })}
                  placeholder="Automatisch op basis van rol"
                />
                <p className="text-xs text-muted-foreground">
                  Laat leeg voor automatische volgorde bij dezelfde rol
                </p>
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
                <Label>Primaire rol *</Label>
                <Select
                  value={form.primaire_rol}
                  onValueChange={(value) => setForm({ ...form, primaire_rol: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer primaire rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((rol) => (
                      <SelectItem key={rol} value={rol}>
                        {rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {form.primaire_rol === 'Stagiair'
                    ? 'Stage bij (primaire afdeling) *'
                    : 'Tweede rol'}
                </Label>
                <Select
                  value={form.tweede_rol || undefined}
                  onValueChange={(value) =>
                    setForm({ ...form, tweede_rol: value === '__none__' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={form.primaire_rol === 'Stagiair' ? 'Selecteer afdeling' : 'Optioneel'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Geen</SelectItem>
                    {availableRoles.map((rol) => (
                      <SelectItem key={rol} value={rol}>
                        {rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.primaire_rol === 'Stagiair' && (
                  <p className="text-xs text-muted-foreground">
                    Selecteer de rol/afdeling waar de stagiair primair stage loopt
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  {form.primaire_rol === 'Stagiair'
                    ? 'Stage bij (secundaire afdeling)'
                    : 'Derde rol'}
                </Label>
                <Select
                  value={form.derde_rol || undefined}
                  onValueChange={(value) =>
                    setForm({ ...form, derde_rol: value === '__none__' ? '' : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optioneel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Geen</SelectItem>
                    {availableRoles.map((rol) => (
                      <SelectItem key={rol} value={rol}>
                        {rol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.primaire_rol === 'Stagiair' && (
                  <p className="text-xs text-muted-foreground">
                    Optioneel: tweede afdeling waar de stagiair meeloopt
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Primaire discipline (automatisch)</Label>
                <Input
                  value={form.discipline}
                  disabled
                  className="bg-muted"
                  placeholder="Wordt automatisch bepaald o.b.v. rol"
                />
                <p className="text-xs text-muted-foreground">
                  Wordt automatisch bepaald op basis van primaire rol
                </p>
              </div>
              <div className="space-y-2">
                <Label>Tweede discipline (automatisch)</Label>
                <Input
                  value={form.discipline_2}
                  disabled
                  className="bg-muted"
                  placeholder="Wordt automatisch bepaald o.b.v. tweede rol"
                />
              </div>
              <div className="space-y-2">
                <Label>Derde discipline (automatisch)</Label>
                <Input
                  value={form.discipline_3}
                  disabled
                  className="bg-muted"
                  placeholder="Wordt automatisch bepaald o.b.v. derde rol"
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
                <Label>Planner (toegang tot systeem)</Label>
              </div>
            </div>

            {/* Gebruikersnaam input - alleen tonen als is_planner = true */}
            {form.is_planner && (
              <div className="space-y-2">
                <Label htmlFor="gebruikersnaam">
                  Gebruikersnaam <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="gebruikersnaam"
                  value={form.gebruikersnaam}
                  onChange={(e) => {
                    // Auto-cleanup: lowercase, alleen letters en cijfers
                    const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
                    setForm({ ...form, gebruikersnaam: cleaned });
                  }}
                  placeholder="bijv. jaimy"
                  required={form.is_planner}
                  maxLength={50}
                />
                <p className="text-xs text-muted-foreground">
                  Voor inloggen op het systeem. Alleen kleine letters en cijfers, minimaal 3 tekens.
                  Standaard wachtwoord: selmore2026
                </p>
              </div>
            )}

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
            <AlertDialogTitle>Medewerker verwijderen?</AlertDialogTitle>
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
