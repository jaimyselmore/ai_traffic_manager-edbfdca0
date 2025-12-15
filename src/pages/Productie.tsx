import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import { useClients, useEmployees } from '@/lib/data';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'concept_productie';

interface FaseData {
  startDatum?: string;
  eindDatum?: string;
  dagen?: number;
  datumTijd?: string;
  locatie?: 'selmore' | 'klant';
  reistijd?: boolean;
  creatief?: boolean;
  aanwezig?: string[];
}

interface ProductieFormData {
  klant: string;
  projectnummer: string;
  projectomschrijving: string;
  datumAanvraag: string;
  opmerkingen: string;
  ellenVoorstel: boolean;
  betrokkenCreatie: boolean;
  creatieTeam: string;
  betrokkenAccount: boolean;
  accountVerantwoordelijke: string;
  betrokkenProductie: boolean;
  producer: string;
  fases: Record<string, FaseData>;
  extraPresentaties: FaseData[];
}

const emptyFormData: ProductieFormData = {
  klant: '',
  projectnummer: '',
  projectomschrijving: '',
  datumAanvraag: new Date().toISOString().split('T')[0],
  opmerkingen: '',
  ellenVoorstel: false,
  betrokkenCreatie: false,
  creatieTeam: '',
  betrokkenAccount: false,
  accountVerantwoordelijke: '',
  betrokkenProductie: false,
  producer: '',
  fases: {
    pp: { startDatum: '', eindDatum: '', creatief: false },
    ppm: { datumTijd: '', locatie: 'selmore', reistijd: false },
    shoot: { dagen: 1, startDatum: '', eindDatum: '', aanwezig: [] },
    offlineEdit: { dagen: 2, startDatum: '', eindDatum: '', creatief: false },
    presentatieOffline: { datumTijd: '', locatie: 'selmore', reistijd: false },
    reEdit: { dagen: 1, startDatum: '', eindDatum: '' },
    presentatieReEdit: { datumTijd: '', locatie: 'selmore', reistijd: false },
    onlineGrading: { dagen: 2, startDatum: '', eindDatum: '' },
    geluid: { dagen: 2, startDatum: '', eindDatum: '' },
    presentatieFinals: { datumTijd: '', locatie: 'selmore', reistijd: false },
    deliverables: { dagen: 1, startDatum: '', eindDatum: '' },
  },
  extraPresentaties: [],
};

const faseLabels: Record<string, { title: string; hint?: string }> = {
  pp: { title: 'PP (pre-productie)', hint: 'Periode waarin creatief team en producer plannen' },
  ppm: { title: 'PPM (pre-productie meeting met klant)' },
  shoot: { title: 'Shoot', hint: '1-2 dagen typisch' },
  offlineEdit: { title: 'Offline edit', hint: '2-5 dagen typisch' },
  presentatieOffline: { title: 'Presentatie offline edit' },
  reEdit: { title: 'Re-edit', hint: '1-2 dagen typisch' },
  presentatieReEdit: { title: 'Presentatie re-edit' },
  onlineGrading: { title: 'Online grading', hint: '2-5 dagen typisch' },
  geluid: { title: 'Geluid', hint: '2-5 dagen typisch' },
  presentatieFinals: { title: 'Presentatie finals' },
  deliverables: { title: 'Deliverables', hint: '1-2 dagen typisch' },
};

export default function Productie() {
  const navigate = useNavigate();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();
  
  const [formData, setFormData] = useState<ProductieFormData>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...emptyFormData, ...JSON.parse(stored) };
    }
    return emptyFormData;
  });
  
  const [openFases, setOpenFases] = useState<Record<string, boolean>>({
    pp: true,
    ppm: false,
    shoot: false,
    offlineEdit: false,
    presentatieOffline: false,
    reEdit: false,
    presentatieReEdit: false,
    onlineGrading: false,
    geluid: false,
    presentatieFinals: false,
    deliverables: false,
  });
  const [deadlineOplevering, setDeadlineOplevering] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
  }, [formData]);

  const handleSaveConcept = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    toast({
      title: 'Concept opgeslagen',
      description: 'Je kunt later verder werken aan dit productieproject.',
    });
  };

  const handleSubmit = async () => {
    if (!formData.klant || !formData.projectomschrijving) {
      toast({
        title: 'Vul verplichte velden in',
        description: 'Klant en projectomschrijving zijn verplicht.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Verzoek wordt ingediend...',
      description: 'Even geduld alstublieft.',
    });

    await new Promise((resolve) => setTimeout(resolve, 1500));
    localStorage.removeItem(STORAGE_KEY);

    navigate('/ellen-session', {
      state: {
        requestType: 'productie',
        formData: { ...formData, deadlineOplevering },
      },
    });
  };

  const toggleFase = (fase: string) => {
    setOpenFases((prev) => ({ ...prev, [fase]: !prev[fase] }));
  };

  const updateFase = (fase: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      fases: {
        ...prev.fases,
        [fase]: { ...prev.fases[fase], [field]: value },
      },
    }));
  };

  const addExtraPresentatie = () => {
    setFormData((prev) => ({
      ...prev,
      extraPresentaties: [
        ...prev.extraPresentaties,
        { datumTijd: '', locatie: 'selmore', reistijd: false },
      ],
    }));
  };

  const renderPeriodeFase = (fase: string) => (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Startdatum</Label>
          <Input
            type="date"
            value={formData.fases[fase]?.startDatum || ''}
            onChange={(e) => updateFase(fase, 'startDatum', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-sm">Einddatum</Label>
          <Input
            type="date"
            value={formData.fases[fase]?.eindDatum || ''}
            onChange={(e) => updateFase(fase, 'eindDatum', e.target.value)}
          />
        </div>
      </div>
      {faseLabels[fase]?.hint && (
        <p className="text-xs text-muted-foreground">{faseLabels[fase].hint}</p>
      )}
      {(fase === 'pp' || fase === 'offlineEdit') && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${fase}-creatief`}
            checked={formData.fases[fase]?.creatief || false}
            onCheckedChange={(checked) => updateFase(fase, 'creatief', checked)}
          />
          <Label htmlFor={`${fase}-creatief`} className="text-sm">
            {fase === 'pp'
              ? 'Creatief team en producer 1 uur per dag in deze periode'
              : 'Creatie is bij editors op locatie gedurende deze periode'}
          </Label>
        </div>
      )}
    </div>
  );

  const renderMeetingFase = (fase: string) => (
    <div className="space-y-4 pt-4">
      <div>
        <Label className="text-sm">Datum & tijd</Label>
        <Input
          type="datetime-local"
          value={formData.fases[fase]?.datumTijd || ''}
          onChange={(e) => updateFase(fase, 'datumTijd', e.target.value)}
        />
      </div>
      <div>
        <Label className="text-sm mb-2 block">Locatie</Label>
        <RadioGroup
          value={formData.fases[fase]?.locatie || 'selmore'}
          onValueChange={(value) => updateFase(fase, 'locatie', value)}
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="selmore" id={`${fase}-selmore`} />
            <Label htmlFor={`${fase}-selmore`} className="text-sm">Bij Selmore</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="klant" id={`${fase}-klant`} />
            <Label htmlFor={`${fase}-klant`} className="text-sm">Bij klant</Label>
          </div>
        </RadioGroup>
      </div>
      {formData.fases[fase]?.locatie === 'klant' && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${fase}-reistijd`}
            checked={formData.fases[fase]?.reistijd || false}
            onCheckedChange={(checked) => updateFase(fase, 'reistijd', checked)}
          />
          <Label htmlFor={`${fase}-reistijd`} className="text-sm">
            Reistijd automatisch inplannen rondom de meeting
          </Label>
        </div>
      )}
    </div>
  );

  const renderDagenFase = (fase: string) => (
    <div className="space-y-4 pt-4">
      <div>
        <Label className="text-sm">Aantal dagen</Label>
        <Input
          type="number"
          min={1}
          value={formData.fases[fase]?.dagen || 1}
          onChange={(e) => updateFase(fase, 'dagen', parseInt(e.target.value))}
          className="w-24"
        />
        {faseLabels[fase]?.hint && (
          <p className="text-xs text-muted-foreground mt-1">{faseLabels[fase].hint}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Startdatum</Label>
          <Input
            type="date"
            value={formData.fases[fase]?.startDatum || ''}
            onChange={(e) => updateFase(fase, 'startDatum', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-sm">Einddatum</Label>
          <Input
            type="date"
            value={formData.fases[fase]?.eindDatum || ''}
            onChange={(e) => updateFase(fase, 'eindDatum', e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="w-full px-6 pt-6 mb-4">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/')}
        >
          ← Terug naar overzicht
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-24 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Productie</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Maak een productieproject aan met de verschillende fases (PP, shoot, edit, presentaties, deliverables) zodat Ellen en de planner hierop kunnen plannen.
          </p>
        </div>

        {/* Projectinformatie */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Projectinformatie</h2>
          
          <div className="grid gap-4">
            <div>
              <Label className="text-sm">Klant *</Label>
              <Select
                value={formData.klant}
                onValueChange={(value) => setFormData({ ...formData, klant: value })}
              >
                <SelectTrigger>
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
            </div>

            <div>
              <Label className="text-sm">Projectnummer</Label>
              <Input
                value={formData.projectnummer}
                onChange={(e) => setFormData({ ...formData, projectnummer: e.target.value })}
                placeholder="Bijv. P2024-001"
              />
            </div>

            <div>
              <Label className="text-sm">Projectomschrijving *</Label>
              <Textarea
                value={formData.projectomschrijving}
                onChange={(e) => setFormData({ ...formData, projectomschrijving: e.target.value })}
                placeholder="Beschrijf het productieproject..."
                rows={3}
              />
            </div>

            <div>
              <Label className="text-sm">Datum aanvraag</Label>
              <Input
                type="date"
                value={formData.datumAanvraag}
                onChange={(e) => setFormData({ ...formData, datumAanvraag: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-sm">Opmerkingen</Label>
              <Textarea
                value={formData.opmerkingen}
                onChange={(e) => setFormData({ ...formData, opmerkingen: e.target.value })}
                placeholder="Extra opmerkingen..."
                rows={2}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Switch
                id="ellen-voorstel"
                checked={formData.ellenVoorstel}
                onCheckedChange={(checked) => setFormData({ ...formData, ellenVoorstel: checked })}
              />
              <Label htmlFor="ellen-voorstel" className="text-sm">
                Laat Ellen een voorstel doen op basis van deze data
              </Label>
            </div>
          </div>
        </div>

        {/* Betrokken team */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Betrokken team</h2>
          <p className="text-sm text-muted-foreground">
            Welke rollen zijn standaard aanwezig bij meetings en presentaties voor dit productieproject?
          </p>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="creatie"
                checked={formData.betrokkenCreatie}
                onCheckedChange={(checked) => setFormData({ ...formData, betrokkenCreatie: !!checked })}
              />
              <div className="flex-1">
                <Label htmlFor="creatie" className="text-sm font-medium">Creatie</Label>
                {formData.betrokkenCreatie && (
                  <Select
                    value={formData.creatieTeam}
                    onValueChange={(value) => setFormData({ ...formData, creatieTeam: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecteer creatief duo/team" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.filter(e => e.role.toLowerCase().includes('creatief') || e.role.toLowerCase().includes('design')).map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="account"
                checked={formData.betrokkenAccount}
                onCheckedChange={(checked) => setFormData({ ...formData, betrokkenAccount: !!checked })}
              />
              <div className="flex-1">
                <Label htmlFor="account" className="text-sm font-medium">Account</Label>
                {formData.betrokkenAccount && (
                  <Select
                    value={formData.accountVerantwoordelijke}
                    onValueChange={(value) => setFormData({ ...formData, accountVerantwoordelijke: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecteer accountverantwoordelijke" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.filter(e => e.role.toLowerCase().includes('account')).map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="productie-team"
                checked={formData.betrokkenProductie}
                onCheckedChange={(checked) => setFormData({ ...formData, betrokkenProductie: !!checked })}
              />
              <div className="flex-1">
                <Label htmlFor="productie-team" className="text-sm font-medium">Productie</Label>
                {formData.betrokkenProductie && (
                  <Select
                    value={formData.producer}
                    onValueChange={(value) => setFormData({ ...formData, producer: value })}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Selecteer producer" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.filter(e => e.role.toLowerCase().includes('producer') || e.role.toLowerCase().includes('productie')).map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fases */}
        <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
          <h2 className="text-lg font-semibold text-foreground mb-4">Fases</h2>

          {/* PP */}
          <Collapsible open={openFases.pp} onOpenChange={() => toggleFase('pp')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.pp.title}</span>
              {openFases.pp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderPeriodeFase('pp')}
            </CollapsibleContent>
          </Collapsible>

          {/* PPM */}
          <Collapsible open={openFases.ppm} onOpenChange={() => toggleFase('ppm')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.ppm.title}</span>
              {openFases.ppm ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderMeetingFase('ppm')}
            </CollapsibleContent>
          </Collapsible>

          {/* Shoot */}
          <Collapsible open={openFases.shoot} onOpenChange={() => toggleFase('shoot')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.shoot.title}</span>
              {openFases.shoot ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderDagenFase('shoot')}
            </CollapsibleContent>
          </Collapsible>

          {/* Offline Edit */}
          <Collapsible open={openFases.offlineEdit} onOpenChange={() => toggleFase('offlineEdit')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.offlineEdit.title}</span>
              {openFases.offlineEdit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderDagenFase('offlineEdit')}
              <div className="flex items-center gap-2 mt-4">
                <Checkbox
                  id="offlineEdit-creatief"
                  checked={formData.fases.offlineEdit?.creatief || false}
                  onCheckedChange={(checked) => updateFase('offlineEdit', 'creatief', checked)}
                />
                <Label htmlFor="offlineEdit-creatief" className="text-sm">
                  Creatie is bij editors op locatie gedurende deze periode
                </Label>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Presentatie Offline Edit */}
          <Collapsible open={openFases.presentatieOffline} onOpenChange={() => toggleFase('presentatieOffline')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.presentatieOffline.title}</span>
              {openFases.presentatieOffline ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderMeetingFase('presentatieOffline')}
            </CollapsibleContent>
          </Collapsible>

          {/* Re-Edit */}
          <Collapsible open={openFases.reEdit} onOpenChange={() => toggleFase('reEdit')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.reEdit.title}</span>
              {openFases.reEdit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderDagenFase('reEdit')}
            </CollapsibleContent>
          </Collapsible>

          {/* Presentatie Re-Edit */}
          <Collapsible open={openFases.presentatieReEdit} onOpenChange={() => toggleFase('presentatieReEdit')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.presentatieReEdit.title}</span>
              {openFases.presentatieReEdit ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderMeetingFase('presentatieReEdit')}
            </CollapsibleContent>
          </Collapsible>

          {/* Online Grading */}
          <Collapsible open={openFases.onlineGrading} onOpenChange={() => toggleFase('onlineGrading')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.onlineGrading.title}</span>
              {openFases.onlineGrading ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderDagenFase('onlineGrading')}
            </CollapsibleContent>
          </Collapsible>

          {/* Geluid */}
          <Collapsible open={openFases.geluid} onOpenChange={() => toggleFase('geluid')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.geluid.title}</span>
              {openFases.geluid ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderDagenFase('geluid')}
            </CollapsibleContent>
          </Collapsible>

          {/* Presentatie Finals */}
          <Collapsible open={openFases.presentatieFinals} onOpenChange={() => toggleFase('presentatieFinals')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.presentatieFinals.title}</span>
              {openFases.presentatieFinals ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderMeetingFase('presentatieFinals')}
            </CollapsibleContent>
          </Collapsible>

          {/* Deliverables */}
          <Collapsible open={openFases.deliverables} onOpenChange={() => toggleFase('deliverables')}>
            <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
              <span className="font-medium text-sm">{faseLabels.deliverables.title}</span>
              {openFases.deliverables ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pb-4">
              {renderDagenFase('deliverables')}
              <div className="mt-4">
                <Label className="text-sm">Studio/Designer</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer studio/designer" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.role.toLowerCase().includes('design') || e.role.toLowerCase().includes('studio')).map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Extra presentaties */}
          {formData.extraPresentaties.map((_, index) => (
            <Collapsible key={`extra-${index}`}>
              <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                <span className="font-medium text-sm">Extra presentatie {index + 1}</span>
                <ChevronDown className="h-4 w-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="px-4 pb-4">
                <div className="space-y-4 pt-4">
                  <div>
                    <Label className="text-sm">Datum & tijd</Label>
                    <Input type="datetime-local" />
                  </div>
                  <div>
                    <Label className="text-sm mb-2 block">Locatie</Label>
                    <RadioGroup defaultValue="selmore">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="selmore" id={`extra-${index}-selmore`} />
                        <Label htmlFor={`extra-${index}-selmore`} className="text-sm">Bij Selmore</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="klant" id={`extra-${index}-klant`} />
                        <Label htmlFor={`extra-${index}-klant`} className="text-sm">Bij klant</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={addExtraPresentatie}
            className="mt-2"
          >
            <Plus className="h-4 w-4 mr-2" />
            Extra presentatie toevoegen
          </Button>
        </div>

        {/* Deadline oplevering */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Deadline oplevering</h2>
          <div>
            <Label className="text-sm">Definitieve opleverdeadline (hard lock)</Label>
            <Input
              type="datetime-local"
              value={deadlineOplevering}
              onChange={(e) => setDeadlineOplevering(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Fixed bottom buttons */}
      <div className="fixed bottom-4 right-4 flex gap-2">
        <Button variant="ghost" onClick={handleSaveConcept}>
          <Save className="mr-2 h-4 w-4" />
          Opslaan als concept
        </Button>
        <Button onClick={handleSubmit}>
          Verzoek indienen
        </Button>
      </div>
    </div>
  );
}
