import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useEmployees } from '@/hooks/use-employees';

export interface FaseData {
  enabled?: boolean;
  startDatum?: string;
  eindDatum?: string;
  dagen?: number;
  dagenMin?: number;  // Minimum dagen (flexibiliteit)
  dagenMax?: number;  // Maximum dagen (flexibiliteit)
  inspanning?: number;  // Alias for dagen, for automation compatibility
  medewerkers?: string[];  // Employee IDs for this fase
  datumTijd?: string;
  locatie?: 'selmore' | 'klant';
  reistijd?: boolean;
  creatief?: boolean;
  aanwezig?: string[];
  flexibel?: boolean;  // Of er speling is in de planning
}

export interface ProductieFasesData {
  fases: Record<string, FaseData>;
  extraPresentaties: FaseData[];
  deadlineOplevering: string;
}

interface ProductieFasesProps {
  data: ProductieFasesData;
  onChange: (data: ProductieFasesData) => void;
}

const faseLabels: Record<string, { title: string; hint?: string }> = {
  pp: { title: 'PP (pre-productie)', hint: 'Periode waarin creatief team en producer plannen' },
  ppm: { title: 'PPM (pre-productie meeting met klant)' },
  shoot: { title: 'Shoot', hint: '1–2 dagen' },
  offlineEdit: { title: 'Offline edit', hint: '2–5 dagen' },
  presentatieOffline: { title: 'Presentatie offline edit' },
  reEdit: { title: 'Re-edit', hint: '1–2 dagen' },
  presentatieReEdit: { title: 'Presentatie re-edit' },
  onlineGrading: { title: 'Online grading', hint: '2–5 dagen' },
  geluid: { title: 'Geluid', hint: '2–5 dagen' },
  presentatieFinals: { title: 'Presentatie finals' },
  deliverables: { title: 'Deliverables', hint: '1–2 dagen' },
};

export function ProductieFases({ data, onChange }: ProductieFasesProps) {
  const { data: employees = [] } = useEmployees();
  const [openFases, setOpenFases] = useState<Record<string, boolean>>({});

  const toggleFase = (fase: string) => {
    setOpenFases(prev => ({ ...prev, [fase]: !prev[fase] }));
  };

  const updateFase = (fase: string, field: string, value: any) => {
    onChange({
      ...data,
      fases: {
        ...data.fases,
        [fase]: { ...data.fases[fase], [field]: value },
      },
    });
  };

  const addExtraPresentatie = () => {
    onChange({
      ...data,
      extraPresentaties: [
        ...data.extraPresentaties,
        { datumTijd: '', locatie: 'selmore', reistijd: false },
      ],
    });
  };

  const renderPeriodeFase = (fase: string) => (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Startdatum</Label>
          <Input
            type="date"
            value={data.fases[fase]?.startDatum || ''}
            onChange={(e) => updateFase(fase, 'startDatum', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-sm">Einddatum</Label>
          <Input
            type="date"
            value={data.fases[fase]?.eindDatum || ''}
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
            checked={data.fases[fase]?.creatief || false}
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
          value={data.fases[fase]?.datumTijd || ''}
          onChange={(e) => updateFase(fase, 'datumTijd', e.target.value)}
        />
      </div>
      <div>
        <Label className="text-sm mb-2 block">Locatie</Label>
        <RadioGroup
          value={data.fases[fase]?.locatie || 'selmore'}
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
      {data.fases[fase]?.locatie === 'klant' && (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${fase}-reistijd`}
            checked={data.fases[fase]?.reistijd || false}
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
          value={data.fases[fase]?.dagen || 1}
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
            value={data.fases[fase]?.startDatum || ''}
            onChange={(e) => updateFase(fase, 'startDatum', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-sm">Einddatum</Label>
          <Input
            type="date"
            value={data.fases[fase]?.eindDatum || ''}
            onChange={(e) => updateFase(fase, 'eindDatum', e.target.value)}
          />
        </div>
      </div>
      <FlexibiliteitVeld fase={fase} />
      <MedewerkerSelectie fase={fase} />
    </div>
  );

  const toggleMedewerker = (fase: string, empId: string) => {
    const currentList = data.fases[fase]?.medewerkers || [];
    const isSelected = currentList.includes(empId);
    const updated = isSelected
      ? currentList.filter(id => id !== empId)
      : [...currentList, empId];
    updateFase(fase, 'medewerkers', updated);
  };

  const MedewerkerSelectie = ({ fase }: { fase: string }) => {
    const selectedIds = data.fases[fase]?.medewerkers || [];
    // Filter op relevante medewerkers (studio/editors/producers)
    const relevantEmployees = employees.filter(e => {
      const role = (e.role || '').toLowerCase();
      return role.includes('editor') || role.includes('producer') || role.includes('studio') ||
             role.includes('motion') || role.includes('designer') || role.includes('creative');
    });

    return (
      <div className="space-y-2 mt-4 pt-4 border-t border-border">
        <Label className="text-sm">Medewerkers voor deze fase</Label>
        <div className="flex flex-wrap gap-2">
          {relevantEmployees.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Geen medewerkers gevonden</p>
          ) : (
            relevantEmployees.map(emp => {
              const isSelected = selectedIds.includes(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleMedewerker(fase, emp.id)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
                  }`}
                >
                  {emp.name}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const FlexibiliteitVeld = ({ fase }: { fase: string }) => {
    const faseData = data.fases[fase];
    const isFlexibel = faseData?.flexibel || false;

    return (
      <div className="space-y-3 mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${fase}-flexibel`}
            checked={isFlexibel}
            onCheckedChange={(checked) => updateFase(fase, 'flexibel', checked)}
          />
          <Label htmlFor={`${fase}-flexibel`} className="text-sm">
            Flexibele planning (speling toestaan)
          </Label>
        </div>
        {isFlexibel && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div>
              <Label className="text-xs text-muted-foreground">Min. dagen</Label>
              <Input
                type="number"
                min={1}
                value={faseData?.dagenMin || faseData?.dagen || 1}
                onChange={(e) => updateFase(fase, 'dagenMin', parseInt(e.target.value))}
                className="w-20"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Max. dagen</Label>
              <Input
                type="number"
                min={1}
                value={faseData?.dagenMax || (faseData?.dagen ? faseData.dagen + 1 : 2)}
                onChange={(e) => updateFase(fase, 'dagenMax', parseInt(e.target.value))}
                className="w-20"
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const FaseCollapsible = ({ fase, children }: { fase: string; children: React.ReactNode }) => {
    const isOpen = openFases[fase] || false;

    return (
      <Collapsible open={isOpen} onOpenChange={() => toggleFase(fase)}>
        <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
          <span className="font-medium text-sm">{faseLabels[fase].title}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          {children}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  // Special Presentatie collapsible that includes extra presentaties and add button inside
  const PresentatieCollapsible = ({
    fase,
    extraPresentaties,
    addExtraPresentatie,
    renderMeetingFase
  }: {
    fase: string;
    extraPresentaties: FaseData[];
    addExtraPresentatie: () => void;
    renderMeetingFase: (fase: string) => React.ReactNode;
  }) => {
    const isOpen = openFases[fase] || false;

    return (
      <Collapsible open={isOpen} onOpenChange={() => toggleFase(fase)}>
        <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
          <span className="font-medium text-sm">{faseLabels[fase].title}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          {renderMeetingFase(fase)}

          {/* Extra presentaties */}
          {extraPresentaties.map((_, index) => (
            <div key={`extra-${index}`} className="mt-4 p-4 border border-border rounded-lg space-y-4">
              <span className="font-medium text-sm">Extra presentatie {index + 1}</span>
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
          ))}

          <Button
            variant="ghost"
            size="sm"
            onClick={addExtraPresentatie}
            className="mt-4"
          >
            <Plus className="h-4 w-4 mr-2" />
            Extra presentatie toevoegen
          </Button>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-6">
      {/* Fases */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-2">
        <h2 className="text-lg font-semibold text-foreground mb-4">Fases</h2>

        <FaseCollapsible fase="pp">{renderPeriodeFase('pp')}</FaseCollapsible>
        <FaseCollapsible fase="ppm">{renderMeetingFase('ppm')}</FaseCollapsible>
        <FaseCollapsible fase="shoot">{renderDagenFase('shoot')}</FaseCollapsible>
        <FaseCollapsible fase="offlineEdit">
          {renderDagenFase('offlineEdit')}
          <div className="flex items-center gap-2 mt-4">
            <Checkbox
              id="offlineEdit-creatief"
              checked={data.fases.offlineEdit?.creatief || false}
              onCheckedChange={(checked) => updateFase('offlineEdit', 'creatief', checked)}
            />
            <Label htmlFor="offlineEdit-creatief" className="text-sm">
              Creatie is bij editors op locatie gedurende deze periode
            </Label>
          </div>
        </FaseCollapsible>
        <FaseCollapsible fase="presentatieOffline">{renderMeetingFase('presentatieOffline')}</FaseCollapsible>
        <FaseCollapsible fase="reEdit">{renderDagenFase('reEdit')}</FaseCollapsible>
        <FaseCollapsible fase="presentatieReEdit">{renderMeetingFase('presentatieReEdit')}</FaseCollapsible>
        <FaseCollapsible fase="onlineGrading">{renderDagenFase('onlineGrading')}</FaseCollapsible>
        <FaseCollapsible fase="geluid">{renderDagenFase('geluid')}</FaseCollapsible>
        <PresentatieCollapsible
          fase="presentatieFinals"
          extraPresentaties={data.extraPresentaties}
          addExtraPresentatie={addExtraPresentatie}
          renderMeetingFase={renderMeetingFase}
        />
        <FaseCollapsible fase="deliverables">
          {renderDagenFase('deliverables')}
          <div className="mt-4">
            <Label className="text-sm">Studio/Designer</Label>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Selecteer studio/designer" />
              </SelectTrigger>
              <SelectContent>
                {employees.filter(e => (e.role || e.primaryRole || '').toLowerCase().includes('design') || (e.role || e.primaryRole || '').toLowerCase().includes('studio')).map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </FaseCollapsible>
      </div>

      {/* Deadline oplevering */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Deadline oplevering</h2>
        <div>
          <Label className="text-sm">Definitieve opleverdeadline (hard lock)</Label>
          <Input
            type="datetime-local"
            value={data.deadlineOplevering}
            onChange={(e) => onChange({ ...data, deadlineOplevering: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

export const emptyProductieFasesData: ProductieFasesData = {
  fases: {
    pp: { enabled: false, startDatum: '', eindDatum: '', creatief: false, dagen: 2, medewerkers: [], flexibel: false },
    ppm: { enabled: false, datumTijd: '', locatie: 'selmore', reistijd: false },
    shoot: { enabled: false, dagen: 1, startDatum: '', eindDatum: '', aanwezig: [], medewerkers: [], flexibel: false },
    offlineEdit: { enabled: false, dagen: 2, startDatum: '', eindDatum: '', creatief: false, medewerkers: [], flexibel: false },
    presentatieOffline: { enabled: false, datumTijd: '', locatie: 'selmore', reistijd: false },
    reEdit: { enabled: false, dagen: 1, startDatum: '', eindDatum: '', medewerkers: [], flexibel: false },
    presentatieReEdit: { enabled: false, datumTijd: '', locatie: 'selmore', reistijd: false },
    onlineGrading: { enabled: false, dagen: 2, startDatum: '', eindDatum: '', medewerkers: [], flexibel: false },
    geluid: { enabled: false, dagen: 2, startDatum: '', eindDatum: '', medewerkers: [], flexibel: false },
    presentatieFinals: { enabled: false, datumTijd: '', locatie: 'selmore', reistijd: false },
    deliverables: { enabled: false, dagen: 1, startDatum: '', eindDatum: '', medewerkers: [], flexibel: false },
  },
  extraPresentaties: [],
  deadlineOplevering: '',
};
