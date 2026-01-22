import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useClients } from '@/lib/data';
import { createClient } from '@/lib/data/dataService';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export interface ProjectHeaderData {
  klantId: string;
  klantIdBasis: string;
  projectVolgnummer: string;
  volledigProjectId: string;
  projectomschrijving: string;
  infoKlant: string;
  datumAanvraag: string;
  deadline: string;
  opmerkingen: string;
  // New client fields (kept for display purposes)
  nieuweKlantNaam?: string;
}

interface ProjectHeaderProps {
  data: ProjectHeaderData;
  onChange: (data: ProjectHeaderData) => void;
  errors?: Record<string, string>;
}

export function ProjectHeader({ data, onChange, errors }: ProjectHeaderProps) {
  const { data: clients = [] } = useClients();
  const queryClient = useQueryClient();
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [tempNewClient, setTempNewClient] = useState({ 
    klantnummer: '', 
    naam: '', 
    contactpersoon: '', 
    email: '', 
    telefoon: '', 
    postcode: '',
    huisnummer: '',
    plaats: '',
    land: '',
    notities: '' 
  });

  // Helper to combine address fields
  const combineAddress = (postcode: string, huisnummer: string, plaats: string, land: string): string => {
    const parts: string[] = [];
    if (postcode || huisnummer) {
      parts.push([postcode, huisnummer].filter(Boolean).join(' '));
    }
    if (plaats) parts.push(plaats);
    if (land) parts.push(land);
    return parts.join(', ');
  };

  // Compute volledig project-ID
  const computeVolledigProjectId = (klantIdBasis: string, volgnummer: string): string => {
    if (!klantIdBasis || !volgnummer) return '';
    const paddedVolgnummer = volgnummer.padStart(2, '0');
    return `${klantIdBasis}${paddedVolgnummer}`;
  };

  const handleKlantChange = (value: string) => {
    if (value === 'new') {
      setIsAddingNewClient(true);
      onChange({
        ...data,
        klantId: '',
        klantIdBasis: '',
        volledigProjectId: '',
      });
    } else {
      setIsAddingNewClient(false);
      const selectedClient = clients.find(c => c.id === value);
      // Use client code as basis for project ID
      const klantIdBasis = selectedClient?.code || '';
      const volledigProjectId = computeVolledigProjectId(klantIdBasis, data.projectVolgnummer);
      onChange({
        ...data,
        klantId: value,
        klantIdBasis,
        volledigProjectId,
        nieuweKlantNaam: undefined,
      });
    }
  };

  const handleVolgnummerChange = (value: string) => {
    // Only allow 2 digits
    const sanitized = value.replace(/\D/g, '').slice(0, 2);
    const volledigProjectId = computeVolledigProjectId(data.klantIdBasis, sanitized);
    onChange({
      ...data,
      projectVolgnummer: sanitized,
      volledigProjectId,
    });
  };

  const handleSaveNewClient = async () => {
    if (!tempNewClient.klantnummer.trim()) {
      toast({
        title: 'Klantnummer is verplicht',
        variant: 'destructive',
      });
      return;
    }
    if (!tempNewClient.naam.trim()) {
      toast({
        title: 'Klantnaam is verplicht',
        variant: 'destructive',
      });
      return;
    }

    setIsSavingClient(true);
    
    try {
      // Save to Supabase
      const newClient = await createClient({
        klantnummer: tempNewClient.klantnummer,
        naam: tempNewClient.naam,
        contactpersoon: tempNewClient.contactpersoon || undefined,
        email: tempNewClient.email || undefined,
        telefoon: tempNewClient.telefoon || undefined,
        adres: combineAddress(tempNewClient.postcode, tempNewClient.huisnummer, tempNewClient.plaats, tempNewClient.land) || undefined,
        notities: tempNewClient.notities || undefined,
      });

      // Invalidate both client cache keys so all dropdowns update (including admin panel)
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['klanten'] });

      // Update form with new client
      const volledigProjectId = computeVolledigProjectId(newClient.code || '', data.projectVolgnummer);
      onChange({
        ...data,
        klantId: newClient.id,
        klantIdBasis: newClient.code || '',
        volledigProjectId,
        nieuweKlantNaam: newClient.name,
      });

      toast({
        title: 'Klant toegevoegd',
        description: `"${newClient.name}" is opgeslagen en geselecteerd.`,
      });

      setIsAddingNewClient(false);
      setTempNewClient({ klantnummer: '', naam: '', contactpersoon: '', email: '', telefoon: '', postcode: '', huisnummer: '', plaats: '', land: '', notities: '' });
    } catch (error) {
      console.error('Fout bij opslaan klant:', error);
      toast({
        title: 'Fout bij opslaan',
        description: error instanceof Error ? error.message : 'Onbekende fout',
        variant: 'destructive',
      });
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleCancelNewClient = () => {
    setIsAddingNewClient(false);
    setTempNewClient({ klantnummer: '', naam: '', contactpersoon: '', email: '', telefoon: '', postcode: '', huisnummer: '', plaats: '', land: '', notities: '' });
  };

  // Find selected client name for display
  const selectedClientName = clients.find(c => c.id === data.klantId)?.name;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Projectgegevens</h2>

      {/* Klant */}
      <div className="space-y-2">
        <Label className="text-sm">Klant *</Label>
        <Select
          value={data.klantId || (isAddingNewClient ? 'new' : '')}
          onValueChange={handleKlantChange}
        >
          <SelectTrigger className={errors?.klantId ? 'border-destructive' : ''}>
            <SelectValue placeholder="Selecteer klant" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
            <SelectItem value="new">+ Nieuwe klant toevoegen</SelectItem>
          </SelectContent>
        </Select>
        {errors?.klantId && (
          <p className="text-xs text-destructive">{errors.klantId}</p>
        )}

        {/* New client inline form */}
        {isAddingNewClient && (
          <div className="mt-3 p-4 bg-secondary/50 rounded-lg space-y-3">
            <p className="text-sm font-medium text-foreground">Nieuwe klant toevoegen</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Klantnummer *</Label>
                <Input
                  value={tempNewClient.klantnummer}
                  onChange={(e) => setTempNewClient({ ...tempNewClient, klantnummer: e.target.value })}
                  placeholder="bijv. K001 of ABC123"
                  className="mt-1"
                  disabled={isSavingClient}
                />
              </div>
              <div>
                <Label className="text-xs">Naam *</Label>
                <Input
                  value={tempNewClient.naam}
                  onChange={(e) => setTempNewClient({ ...tempNewClient, naam: e.target.value })}
                  placeholder="Naam van de klant"
                  className="mt-1"
                  disabled={isSavingClient}
                />
              </div>
              <div>
                <Label className="text-xs">Contactpersoon</Label>
                <Input
                  value={tempNewClient.contactpersoon}
                  onChange={(e) => setTempNewClient({ ...tempNewClient, contactpersoon: e.target.value })}
                  placeholder="Contactpersoon"
                  className="mt-1"
                  disabled={isSavingClient}
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={tempNewClient.email}
                  onChange={(e) => setTempNewClient({ ...tempNewClient, email: e.target.value })}
                  placeholder="email@voorbeeld.nl"
                  className="mt-1"
                  disabled={isSavingClient}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Telefoon</Label>
                <Input
                  value={tempNewClient.telefoon}
                  onChange={(e) => setTempNewClient({ ...tempNewClient, telefoon: e.target.value })}
                  placeholder="Telefoonnummer"
                  className="mt-1"
                  disabled={isSavingClient}
                />
              </div>
              <div>
                <Label className="text-xs">Postcode</Label>
                <Input
                  value={tempNewClient.postcode}
                  onChange={(e) => setTempNewClient({ ...tempNewClient, postcode: e.target.value })}
                  placeholder="1234 AB"
                  className="mt-1"
                  disabled={isSavingClient}
                />
              </div>
              <div>
                <Label className="text-xs">Huisnummer</Label>
                <Input
                  value={tempNewClient.huisnummer}
                  onChange={(e) => setTempNewClient({ ...tempNewClient, huisnummer: e.target.value })}
                  placeholder="123a"
                  className="mt-1"
                  disabled={isSavingClient}
                />
              </div>
              <div>
                <Label className="text-xs">Plaats</Label>
                <Input
                  value={tempNewClient.plaats}
                  onChange={(e) => setTempNewClient({ ...tempNewClient, plaats: e.target.value })}
                  placeholder="Amsterdam"
                  className="mt-1"
                  disabled={isSavingClient}
                />
              </div>
              <div>
                <Label className="text-xs">Land</Label>
                <Input
                  value={tempNewClient.land}
                  onChange={(e) => setTempNewClient({ ...tempNewClient, land: e.target.value })}
                  placeholder="Nederland"
                  className="mt-1"
                  disabled={isSavingClient}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Notities</Label>
              <Textarea
                value={tempNewClient.notities}
                onChange={(e) => setTempNewClient({ ...tempNewClient, notities: e.target.value })}
                placeholder="Extra notities..."
                rows={2}
                className="mt-1"
                disabled={isSavingClient}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={handleSaveNewClient} disabled={isSavingClient}>
                {isSavingClient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Toevoegen
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelNewClient} disabled={isSavingClient}>
                Annuleren
              </Button>
            </div>
          </div>
        )}

        {/* Show selected client info */}
        {selectedClientName && !isAddingNewClient && data.nieuweKlantNaam && (
          <p className="text-sm text-muted-foreground">
            Nieuwe klant: <span className="font-medium text-foreground">{selectedClientName}</span>
          </p>
        )}
      </div>

      {/* Klantnummer (read-only) */}
      {data.klantIdBasis && (
        <div>
          <p className="text-sm text-muted-foreground">
            Klantnummer: <span className="font-medium text-foreground">{data.klantIdBasis}</span>
          </p>
        </div>
      )}

      {/* Project volgnummer */}
      <div>
        <Label className="text-sm">Project volgnummer *</Label>
        <Input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={data.projectVolgnummer}
          onChange={(e) => handleVolgnummerChange(e.target.value)}
          placeholder="01"
          className={`w-20 ${errors?.projectVolgnummer ? 'border-destructive' : ''}`}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Volgnummer van dit project bij deze klant (01–99).
        </p>
        {errors?.projectVolgnummer && (
          <p className="text-xs text-destructive">{errors.projectVolgnummer}</p>
        )}
      </div>

      {/* Volledig project-ID (read-only) */}
      {data.volledigProjectId && (
        <div className="p-3 bg-secondary/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Volledig project-ID: <span className="font-semibold text-foreground">{data.volledigProjectId}</span>
          </p>
        </div>
      )}

      {/* Projectomschrijving */}
      <div>
        <Label className="text-sm">Projectomschrijving *</Label>
        <Textarea
          value={data.projectomschrijving}
          onChange={(e) => onChange({ ...data, projectomschrijving: e.target.value })}
          placeholder="Beschrijf het project..."
          rows={3}
          className={errors?.projectomschrijving ? 'border-destructive' : ''}
        />
        {errors?.projectomschrijving && (
          <p className="text-xs text-destructive">{errors.projectomschrijving}</p>
        )}
      </div>

      {/* Info klant */}
      <div>
        <Label className="text-sm">Info klant</Label>
        <Textarea
          value={data.infoKlant}
          onChange={(e) => onChange({ ...data, infoKlant: e.target.value })}
          placeholder="Extra informatie over de klant of context..."
          rows={2}
        />
      </div>

      {/* Datum aanvraag */}
      <div>
        <Label className="text-sm">Datum aanvraag</Label>
        <Input
          type="date"
          value={data.datumAanvraag}
          onChange={(e) => onChange({ ...data, datumAanvraag: e.target.value })}
        />
      </div>

      {/* Deadline */}
      <div>
        <Label className="text-sm">Deadline</Label>
        <Input
          type="date"
          value={data.deadline}
          onChange={(e) => onChange({ ...data, deadline: e.target.value })}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Gewenste opleverdatum (indien bekend).
        </p>
      </div>

      {/* Opmerkingen */}
      <div>
        <Label className="text-sm">Opmerkingen</Label>
        <Textarea
          value={data.opmerkingen}
          onChange={(e) => onChange({ ...data, opmerkingen: e.target.value })}
          placeholder="Extra opmerkingen (optioneel)..."
          rows={2}
        />
      </div>
    </div>
  );
}

export const emptyProjectHeaderData: ProjectHeaderData = {
  klantId: '',
  klantIdBasis: '',
  projectVolgnummer: '',
  volledigProjectId: '',
  projectomschrijving: '',
  infoKlant: '',
  datumAanvraag: new Date().toISOString().split('T')[0],
  deadline: '',
  opmerkingen: '',
};
