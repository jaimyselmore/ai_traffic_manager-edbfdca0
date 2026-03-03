import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useEmployees } from '@/hooks/use-employees';
import { DatePicker } from '@/components/ui/date-picker';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { format, parse, isValid } from 'date-fns';

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
  urenPerDag?: number;  // Uren per dag voor deze fase
  aanwezig?: string[];
  flexibel?: boolean;  // Of er speling is in de planning
}

export interface ProductieFasesData {
  projectTeamIds: string[]; // Basis projectteam
  fases: Record<string, FaseData>;
  extraPresentaties: FaseData[];
  deadlineOplevering: string;
}

interface ProductieFasesProps {
  data: ProductieFasesData;
  onChange: (data: ProductieFasesData) => void;
}

// Helper functions voor datum conversie
const parseDate = (dateStr: string | undefined): Date | undefined => {
  if (!dateStr) return undefined;
  // Try dd-mm-yyyy format first
  const parsed = parse(dateStr, 'dd-MM-yyyy', new Date());
  if (isValid(parsed)) return parsed;
  // Try ISO format as fallback
  const isoDate = new Date(dateStr);
  return isValid(isoDate) ? isoDate : undefined;
};

const formatDate = (date: Date | undefined): string => {
  if (!date || !isValid(date)) return '';
  return format(date, 'dd-MM-yyyy');
};

const faseLabels: Record<string, { title: string; hint?: string }> = {
  pp: { title: 'PP (pre-productie)' },
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

  // Toggle medewerker in projectteam
  const toggleProjectTeamMember = (empId: string) => {
    const isSelected = data.projectTeamIds.includes(empId);
    const newTeamIds = isSelected
      ? data.projectTeamIds.filter(id => id !== empId)
      : [...data.projectTeamIds, empId];

    // Update ALL fases to reflect team changes
    const updatedFases = { ...data.fases };
    Object.keys(updatedFases).forEach(faseKey => {
      const fase = updatedFases[faseKey];
      const currentMedewerkers = fase?.medewerkers || [];

      if (isSelected) {
        // Remove from all fases
        updatedFases[faseKey] = {
          ...fase,
          medewerkers: currentMedewerkers.filter(id => id !== empId)
        };
      } else {
        // Add to all fases (if not already present)
        if (!currentMedewerkers.includes(empId)) {
          updatedFases[faseKey] = {
            ...fase,
            medewerkers: [...currentMedewerkers, empId]
          };
        }
      }
    });

    onChange({
      ...data,
      projectTeamIds: newTeamIds,
      fases: updatedFases
    });
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

  const renderPeriodeFase = (fase: string) => {
    const dateRange: DateRange | undefined = data.fases[fase]?.startDatum || data.fases[fase]?.eindDatum
      ? {
          from: parseDate(data.fases[fase]?.startDatum),
          to: parseDate(data.fases[fase]?.eindDatum),
        }
      : undefined;

    return (
      <div className="space-y-4 pt-4">
        <div>
          <Label className="text-sm">Periode</Label>
          <DateRangePicker
            value={dateRange}
            onChange={(range) => {
              updateFase(fase, 'startDatum', formatDate(range?.from));
              updateFase(fase, 'eindDatum', formatDate(range?.to));
            }}
            placeholder="Selecteer start- en einddatum"
          />
        </div>
        {faseLabels[fase]?.hint && (
          <p className="text-xs text-muted-foreground">{faseLabels[fase].hint}</p>
        )}
        {fase === 'pp' && (
          <div className="flex items-center gap-3">
            <Label className="text-sm whitespace-nowrap">Uur per dag:</Label>
            <Input
              type="number"
              min="0.5"
              max="8"
              step="0.5"
              value={data.fases[fase]?.urenPerDag || ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  updateFase(fase, 'urenPerDag', val === '' ? '' : parseFloat(val));
                }
              }}
              className="w-20"
              placeholder="1"
            />
          </div>
        )}
        {fase === 'offlineEdit' && (
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${fase}-creatief`}
              checked={data.fases[fase]?.creatief || false}
              onCheckedChange={(checked) => updateFase(fase, 'creatief', checked)}
            />
            <Label htmlFor={`${fase}-creatief`} className="text-sm">
              Creatie is bij editors op locatie gedurende deze periode
            </Label>
          </div>
        )}
      </div>
    );
  };

  const renderMeetingFase = (fase: string) => (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Datum</Label>
          <DatePicker
            value={parseDate(data.fases[fase]?.startDatum)}
            onChange={(date) => updateFase(fase, 'startDatum', formatDate(date))}
            placeholder="Selecteer datum"
          />
        </div>
        <div>
          <Label className="text-sm">Tijd</Label>
          <Input
            type="time"
            value={data.fases[fase]?.datumTijd || ''}
            onChange={(e) => updateFase(fase, 'datumTijd', e.target.value)}
            className="h-10"
          />
        </div>
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
      <MedewerkerSelectie fase={fase} />
    </div>
  );

  const renderDagenFase = (fase: string) => {
    const dateRange: DateRange | undefined = data.fases[fase]?.startDatum || data.fases[fase]?.eindDatum
      ? {
          from: parseDate(data.fases[fase]?.startDatum),
          to: parseDate(data.fases[fase]?.eindDatum),
        }
      : undefined;

    return (
      <div className="space-y-4 pt-4">
        <div>
          <Label className="text-sm">Aantal dagen</Label>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={data.fases[fase]?.dagen || ''}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || /^\d+$/.test(val)) {
                updateFase(fase, 'dagen', val === '' ? '' : parseInt(val));
              }
            }}
            className="w-24"
            placeholder="1"
          />
          {faseLabels[fase]?.hint && (
            <p className="text-xs text-muted-foreground mt-1">{faseLabels[fase].hint}</p>
          )}
        </div>
        <div>
          <Label className="text-sm">Periode</Label>
          <DateRangePicker
            value={dateRange}
            onChange={(range) => {
              updateFase(fase, 'startDatum', formatDate(range?.from));
              updateFase(fase, 'eindDatum', formatDate(range?.to));
            }}
            placeholder="Selecteer start- en einddatum"
          />
        </div>
        <MedewerkerSelectie fase={fase} />
      </div>
    );
  };

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
    const availableEmployees = employees.filter(e => !selectedIds.includes(e.id));
    const [isAddOpen, setIsAddOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const addMember = (empId: string) => {
      const currentList = data.fases[fase]?.medewerkers || [];
      updateFase(fase, 'medewerkers', [...currentList, empId]);
      setIsAddOpen(false);
    };

    // Close dropdown on click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsAddOpen(false);
        }
      };

      if (isAddOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isAddOpen]);

    return (
      <div className="space-y-2 mt-4 pt-4 border-t border-border">
        <Label className="text-sm">Medewerkers voor deze fase</Label>
        <div className="flex flex-wrap gap-2">
          {selectedIds.map(empId => {
            const emp = employees.find(e => e.id === empId);
            if (!emp) return null;
            return (
              <div
                key={emp.id}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full bg-primary text-primary-foreground border border-primary"
              >
                <span>{emp.name}</span>
                <button
                  type="button"
                  onClick={() => toggleMedewerker(fase, emp.id)}
                  className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}

          {/* Plus knop om iemand toe te voegen */}
          {availableEmployees.length > 0 && (
            <div className="relative inline-block" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsAddOpen(!isAddOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-dashed border-primary/50 text-primary hover:bg-primary/5 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Toevoegen</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isAddOpen ? 'rotate-180' : ''}`} />
              </button>

              {isAddOpen && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-[240px] overflow-y-auto">
                  {availableEmployees.map(emp => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => addMember(emp.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center justify-between"
                    >
                      <span>{emp.name}</span>
                      <span className="text-xs text-muted-foreground">{emp.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedIds.length === 0 && (
          <p className="text-xs text-muted-foreground">Nog geen medewerkers - voeg via projectteam of klik op toevoegen</p>
        )}
      </div>
    );
  };


  const FaseCollapsible = ({ fase, children }: { fase: string; children: React.ReactNode }) => {
    const isOpen = openFases[fase] || false;

    return (
      <Collapsible open={isOpen} onOpenChange={(open) => setOpenFases(prev => ({ ...prev, [fase]: open }))}>
        <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors scroll-mt-24">
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
      <Collapsible open={isOpen} onOpenChange={(open) => setOpenFases(prev => ({ ...prev, [fase]: open }))}>
        <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors scroll-mt-24">
          <span className="font-medium text-sm">{faseLabels[fase].title}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          {renderMeetingFase(fase)}

          {/* Extra presentaties */}
          {extraPresentaties.map((extra, index) => (
            <div key={`extra-${index}`} className="mt-4 p-4 border border-border rounded-lg space-y-4">
              <span className="font-medium text-sm">Extra presentatie {index + 1}</span>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm">Datum</Label>
                  <DatePicker
                    value={parseDate(extra.startDatum)}
                    onChange={(date) => {
                      const updated = [...extraPresentaties];
                      updated[index] = { ...updated[index], startDatum: formatDate(date) };
                      onChange({ ...data, extraPresentaties: updated });
                    }}
                    placeholder="Selecteer datum"
                  />
                </div>
                <div>
                  <Label className="text-sm">Tijd</Label>
                  <Input
                    type="time"
                    value={extra.datumTijd || ''}
                    onChange={(e) => {
                      const updated = [...extraPresentaties];
                      updated[index] = { ...updated[index], datumTijd: e.target.value };
                      onChange({ ...data, extraPresentaties: updated });
                    }}
                    className="h-10"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Locatie</Label>
                <RadioGroup
                  value={extra.locatie || 'selmore'}
                  onValueChange={(value) => {
                    const updated = [...extraPresentaties];
                    updated[index] = { ...updated[index], locatie: value as 'selmore' | 'klant' };
                    onChange({ ...data, extraPresentaties: updated });
                  }}
                >
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
      {/* Projectteam */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Projectteam</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Selecteer het kernteam voor dit project. Dit team wordt automatisch aan alle fases toegevoegd.
        </p>

        <div className="flex flex-wrap gap-2">
          {employees.map(emp => {
            const isSelected = data.projectTeamIds.includes(emp.id);
            return (
              <button
                key={emp.id}
                type="button"
                onClick={() => toggleProjectTeamMember(emp.id)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
                }`}
              >
                {emp.name}
              </button>
            );
          })}
        </div>
      </div>

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
        </FaseCollapsible>
      </div>
    </div>
  );
}

export const emptyProductieFasesData: ProductieFasesData = {
  projectTeamIds: [],
  fases: {
    pp: { enabled: false, startDatum: '', eindDatum: '', urenPerDag: 1, dagen: 2, medewerkers: [], flexibel: false },
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
