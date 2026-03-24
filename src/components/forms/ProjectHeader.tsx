import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { useClients } from '@/hooks/use-clients';
import { createClient } from '@/lib/data/dataService';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { format, parse, isValid } from 'date-fns';

// Helper functions voor datum conversie
const parseDate = (dateStr: string | undefined): Date | undefined => {
  if (!dateStr) return undefined;
  // Try ISO format first (YYYY-MM-DD from date inputs)
  const isoDate = new Date(dateStr);
  if (isValid(isoDate)) return isoDate;
  // Try dd-MM-yyyy format
  const parsed = parse(dateStr, 'dd-MM-yyyy', new Date());
  return isValid(parsed) ? parsed : undefined;
};

const formatDateISO = (date: Date | undefined): string => {
  if (!date || !isValid(date)) return '';
  return format(date, 'yyyy-MM-dd');
};

export interface ProjectHeaderData {
  klantId: string;
  klantIdBasis: string;
  projectVolgnummer: string;
  volledigProjectId: string;
  projectNaam: string; // Custom title entered by user
  projectTitel: string; // Full title: klant_nummer_naam
  projectomschrijving: string;
  datumAanvraag: string;
  startDatum: string; // Vanaf wanneer er ingepland moet worden
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
    reistijd_minuten: '',
    interne_notities: '',
    planning_instructies: '',
  });

  // Compute volledig project-ID (geen voorloop-nul)
  const computeVolledigProjectId = (klantIdBasis: string, volgnummer: string): string => {
    if (!klantIdBasis || !volgnummer) return '';
    return `${klantIdBasis}${volgnummer}`;
  };

  // Compute project titel: klant_nummer_naam
  const computeProjectTitel = (klantnaam: string, volledigProjectId: string, projectNaam: string): string => {
    if (!klantnaam || !volledigProjectId) return '';
    const baseTitel = `${klantnaam}_${volledigProjectId}`;
    if (projectNaam?.trim()) {
      return `${baseTitel}_${projectNaam.trim()}`;
    }
    return baseTitel;
  };

  const handleKlantChange = (value: string) => {
    if (value === 'new') {
      setIsAddingNewClient(true);
      onChange({
        ...data,
        klantId: '',
        klantIdBasis: '',
        volledigProjectId: '',
        projectTitel: '',
      });
    } else {
      setIsAddingNewClient(false);
      const selectedClient = clients.find(c => c.id === value);
      // Use client code as basis for project ID
      const klantIdBasis = selectedClient?.code || '';
      const klantnaam = selectedClient?.name || '';
      const volledigProjectId = computeVolledigProjectId(klantIdBasis, data.projectVolgnummer);
      const projectTitel = computeProjectTitel(klantnaam, volledigProjectId, data.projectNaam || '');
      onChange({
        ...data,
        klantId: value,
        klantIdBasis,
        volledigProjectId,
        projectTitel,
        nieuweKlantNaam: undefined,
      });
    }
  };

  const handleVolgnummerChange = (value: string) => {
    // Only allow 2 digits
    const sanitized = value.replace(/\D/g, '').slice(0, 2);
    const volledigProjectId = computeVolledigProjectId(data.klantIdBasis, sanitized);
    const selectedClient = clients.find(c => c.id === data.klantId);
    const klantnaam = selectedClient?.name || '';
    const projectTitel = computeProjectTitel(klantnaam, volledigProjectId, data.projectNaam || '');
    onChange({
      ...data,
      projectVolgnummer: sanitized,
      volledigProjectId,
      projectTitel,
    });
  };

  const handleProjectNaamChange = (value: string) => {
    const selectedClient = clients.find(c => c.id === data.klantId);
    const klantnaam = selectedClient?.name || '';
    const projectTitel = computeProjectTitel(klantnaam, data.volledigProjectId, value);
    onChange({
      ...data,
      projectNaam: value,
      projectTitel,
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
        reistijd_minuten: tempNewClient.reistijd_minuten ? parseInt(tempNewClient.reistijd_minuten, 10) : undefined,
        interne_notities: tempNewClient.interne_notities || undefined,
        planning_instructies: tempNewClient.planning_instructies || undefined,
      });

      // Invalidate both client cache keys so all dropdowns update (including admin panel)
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      await queryClient.invalidateQueries({ queryKey: ['klanten'] });

      // Update form with new client
      const volledigProjectId = computeVolledigProjectId(newClient.code || '', data.projectVolgnummer);
      const projectTitel = computeProjectTitel(newClient.name, volledigProjectId, data.projectNaam || '');
      onChange({
        ...data,
        klantId: newClient.id,
        klantIdBasis: newClient.code || '',
        volledigProjectId,
        projectTitel,
        nieuweKlantNaam: newClient.name,
      });

      toast({
        title: 'Klant toegevoegd',
        description: `"${newClient.name}" is opgeslagen en geselecteerd.`,
      });

      setIsAddingNewClient(false);
      setTempNewClient({ klantnummer: '', naam: '', reistijd_minuten: '', interne_notities: '', planning_instructies: '' });
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
    setTempNewClient({ klantnummer: '', naam: '', reistijd_minuten: '', interne_notities: '', planning_instructies: '' });
  };

  // Find selected client name for display
  const selectedClientName = clients.find(c => c.id === data.klantId)?.name;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <h2 className="text-base font-semibold text-foreground">Projectgegevens</h2>

      {/* Klant + Volgnummer */}
      <div className="flex gap-3 items-end">
        <div className="flex-1 space-y-1.5">
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
          {errors?.klantId && <p className="text-xs text-destructive">{errors.klantId}</p>}
        </div>
        <div className="w-24 space-y-1.5">
          <Label className="text-sm">Volgnr. *</Label>
          <Input
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={data.projectVolgnummer}
            onChange={(e) => handleVolgnummerChange(e.target.value)}
            placeholder="1"
            className={errors?.projectVolgnummer ? 'border-destructive' : ''}
          />
          {errors?.projectVolgnummer && <p className="text-xs text-destructive">{errors.projectVolgnummer}</p>}
        </div>
      </div>

      {/* New client inline form */}
      {isAddingNewClient && (
        <div className="p-3 bg-secondary/50 rounded-lg space-y-3">
          <p className="text-sm font-medium">Nieuwe klant toevoegen</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Klantnummer *</Label>
              <Input value={tempNewClient.klantnummer} onChange={(e) => setTempNewClient({ ...tempNewClient, klantnummer: e.target.value })} placeholder="bijv. K001" className="mt-1" disabled={isSavingClient} />
            </div>
            <div>
              <Label className="text-xs">Naam *</Label>
              <Input value={tempNewClient.naam} onChange={(e) => setTempNewClient({ ...tempNewClient, naam: e.target.value })} placeholder="Naam van de klant" className="mt-1" disabled={isSavingClient} />
            </div>
            <div>
              <Label className="text-xs">Reistijd (min)</Label>
              <Input type="number" min="0" value={tempNewClient.reistijd_minuten} onChange={(e) => setTempNewClient({ ...tempNewClient, reistijd_minuten: e.target.value })} placeholder="45" className="mt-1" disabled={isSavingClient} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Interne notities</Label>
              <Textarea value={tempNewClient.interne_notities} onChange={(e) => setTempNewClient({ ...tempNewClient, interne_notities: e.target.value })} rows={2} className="mt-1" disabled={isSavingClient} />
            </div>
            <div>
              <Label className="text-xs">Planning instructies</Label>
              <Textarea value={tempNewClient.planning_instructies} onChange={(e) => setTempNewClient({ ...tempNewClient, planning_instructies: e.target.value })} placeholder="Klant wil alleen ochtend..." rows={2} className="mt-1" disabled={isSavingClient} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveNewClient} disabled={isSavingClient}>
              {isSavingClient && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Toevoegen
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancelNewClient} disabled={isSavingClient}>Annuleren</Button>
          </div>
        </div>
      )}

      {/* Project-ID + Titel (lees-alleen info) */}
      {data.volledigProjectId && (
        <div className="flex items-baseline gap-3 px-3 py-2 bg-secondary/40 rounded-lg">
          <span className="text-xs text-muted-foreground shrink-0">ID</span>
          <span className="text-sm font-semibold text-foreground shrink-0">{data.volledigProjectId}</span>
          {data.projectTitel && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground truncate">{data.projectTitel}</span>
            </>
          )}
        </div>
      )}

      {/* Projectnaam */}
      {data.volledigProjectId && (
        <div>
          <Label className="text-sm">Projectnaam *</Label>
          <Input
            value={data.projectNaam || ''}
            onChange={(e) => handleProjectNaamChange(e.target.value)}
            placeholder="bijv. Zomercampagne"
            className={`mt-1 ${errors?.projectNaam ? 'border-destructive' : ''}`}
          />
          {errors?.projectNaam && <p className="text-xs text-destructive mt-0.5">{errors.projectNaam}</p>}
        </div>
      )}

      {/* Startdatum + Deadline */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-sm">Startdatum *</Label>
          <div className="mt-1">
            <DatePicker
              value={parseDate(data.startDatum)}
              onChange={(date) => onChange({ ...data, startDatum: formatDateISO(date) })}
              placeholder="Selecteer datum"
            />
          </div>
          {errors?.startDatum && <p className="text-xs text-destructive mt-0.5">{errors.startDatum}</p>}
        </div>
        <div>
          <Label className="text-sm">Deadline *</Label>
          <div className="mt-1">
            <DatePicker
              value={parseDate(data.deadline)}
              onChange={(date) => onChange({ ...data, deadline: formatDateISO(date) })}
              placeholder="Selecteer datum"
            />
          </div>
          {errors?.deadline && <p className="text-xs text-destructive mt-0.5">{errors.deadline}</p>}
        </div>
      </div>

      {/* Opmerkingen */}
      <div>
        <Label className="text-sm">Opmerkingen</Label>
        <Textarea
          value={data.opmerkingen}
          onChange={(e) => onChange({ ...data, opmerkingen: e.target.value })}
          placeholder="Extra opmerkingen (optioneel)..."
          rows={2}
          className="mt-1"
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
  projectNaam: '',
  projectTitel: '',
  projectomschrijving: '',
  datumAanvraag: new Date().toISOString().split('T')[0],
  startDatum: '',
  deadline: '',
  opmerkingen: '',
};
