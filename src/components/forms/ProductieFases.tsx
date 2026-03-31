import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
  dagenMin?: number;
  dagenMax?: number;
  inspanning?: number;
  medewerkers?: string[];
  datumTijd?: string;
  locatie?: 'selmore' | 'klant';
  reistijd?: boolean;
  creatief?: boolean;
  urenPerDag?: number;
  aanwezig?: string[];
  flexibel?: boolean;
}

export interface ProductieFasesData {
  projectTeamIds: string[];
  fases: Record<string, FaseData>;
  extraPresentaties: FaseData[];
  deadlineOplevering: string;
}

interface ProductieFasesProps {
  data: ProductieFasesData;
  onChange: (data: ProductieFasesData) => void;
}

const parseDate = (dateStr: string | undefined): Date | undefined => {
  if (!dateStr) return undefined;
  const parsed = parse(dateStr, 'dd-MM-yyyy', new Date());
  if (isValid(parsed)) return parsed;
  const isoDate = new Date(dateStr);
  return isValid(isoDate) ? isoDate : undefined;
};

const formatDate = (date: Date | undefined): string => {
  if (!date || !isValid(date)) return '';
  return format(date, 'dd-MM-yyyy');
};

const faseLabels: Record<string, string> = {
  pp: 'PP (pre-productie)',
  ppm: 'PPM (pre-productie meeting met klant)',
  shoot: 'Shoot',
  offlineEdit: 'Offline edit',
  presentatieOffline: 'Presentatie offline edit',
  reEdit: 'Re-edit',
  presentatieReEdit: 'Presentatie re-edit',
  onlineGrading: 'Online grading',
  geluid: 'Geluid',
  presentatieFinals: 'Presentatie finals',
  deliverables: 'Deliverables',
};

// --- Sub-components defined OUTSIDE ProductieFases to prevent remounting on parent re-render ---

interface MedewerkerSelectieProps {
  selectedIds: string[];
  employees: Array<{ id: string; name: string; role?: string }>;
  onToggleMedewerker: (empId: string) => void;
  onAddMedewerker: (empId: string) => void;
}

function MedewerkerSelectie({ selectedIds, employees, onToggleMedewerker, onAddMedewerker }: MedewerkerSelectieProps) {
  const availableEmployees = employees.filter(e => !selectedIds.includes(e.id));
  const [isAddOpen, setIsAddOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const addMember = (empId: string) => {
    onAddMedewerker(empId);
    setIsAddOpen(false);
  };

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
      <Label className="text-sm">Medewerkers</Label>
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
                onClick={() => onToggleMedewerker(emp.id)}
                className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}

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
              <div
                className="fixed z-[100] bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[200px] max-h-[240px] overflow-y-auto"
                style={{
                  top: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().bottom + 4 : 0,
                  left: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().left : 0,
                }}
              >
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
        <p className="text-xs text-muted-foreground">Selecteer medewerkers via projectteam of klik toevoegen</p>
      )}
    </div>
  );
}

// Volgorde van fases in de tijdlijn
const FASE_VOLGORDE = ['pp', 'ppm', 'shoot', 'offlineEdit', 'presentatieOffline', 'reEdit', 'presentatieReEdit', 'onlineGrading', 'geluid', 'presentatieFinals', 'deliverables'] as const;
const MEETING_FASES = new Set(['ppm', 'presentatieOffline', 'presentatieReEdit', 'presentatieFinals']);

// Korte labels voor in de tijdlijnbalk
const faseLabelKort: Record<string, string> = {
  pp: 'PP', ppm: 'PPM', shoot: 'Shoot', offlineEdit: 'Offline', presentatieOffline: 'Pres. OE',
  reEdit: 'Re-edit', presentatieReEdit: 'Pres. RE', onlineGrading: 'Grading', geluid: 'Geluid',
  presentatieFinals: 'Pres. Finals', deliverables: 'Deliverables',
};

/**
 * Tijdlijnbalk voor productiefases: toont alle ingeschakelde fases in volgorde
 * met breedte proportioneel aan het aantal uren.
 */
function ProductieTimeline({ fases }: { fases: Record<string, FaseData> }) {
  const items = FASE_VOLGORDE
    .filter(k => fases[k]?.enabled)
    .map(k => {
      const fase = fases[k];
      const isMeeting = MEETING_FASES.has(k);
      const uren = isMeeting ? 2 : (fase.dagen || 1) * (fase.urenPerDag || 8);
      return { key: k, uren, isMeeting };
    });

  const totaalUren = items.reduce((s, f) => s + f.uren, 0);
  const pct = (u: number) => `${Math.max((u / totaalUren) * 100, 2.5)}%`;

  return (
    <div className="pb-4 border-b border-border mb-4">
      <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
        {items.length === 0 ? 'Tijdlijn — schakel fases in' : `Tijdlijn — ${totaalUren}u totaal`}
      </p>
      <div className="flex h-8 w-full rounded-md overflow-hidden border border-border gap-px bg-border">
        {items.length === 0 ? (
          // Placeholder: alle fases gelijk breed in licht grijs
          FASE_VOLGORDE.map(k => {
            const isMeeting = MEETING_FASES.has(k);
            return (
              <div
                key={k}
                className={`flex flex-1 items-center justify-center overflow-hidden ${isMeeting ? 'bg-pink-50 text-pink-400' : 'bg-violet-50 text-violet-400'}`}
                title={faseLabels[k]}
              >
                <span className="text-[8px] font-semibold truncate px-0.5">{faseLabelKort[k]}</span>
              </div>
            );
          })
        ) : (
          items.map(({ key, uren, isMeeting }) => (
            <div
              key={key}
              className={`flex items-center justify-center overflow-hidden transition-all duration-300 ${isMeeting ? 'bg-pink-200 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300' : 'bg-violet-200 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300'}`}
              style={{ width: pct(uren), minWidth: '1.5rem' }}
              title={`${faseLabels[key]}: ${uren}u`}
            >
              <div className="flex flex-col items-center leading-none px-1">
                <span className="text-[9px] font-semibold truncate">{faseLabelKort[key]}</span>
                <span className="text-[8px] opacity-60">{uren}u</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface FaseCollapsibleProps {
  fase: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FaseCollapsible({ fase, isOpen, onToggle, children }: FaseCollapsibleProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
      >
        <span className="font-medium text-sm">{faseLabels[fase]}</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 overflow-visible">
          {children}
        </div>
      )}
    </div>
  );
}

interface PresentatieCollapsibleProps {
  fase: string;
  isOpen: boolean;
  onToggle: () => void;
  extraPresentaties: FaseData[];
  addExtraPresentatie: () => void;
  onUpdateExtraPresentaties: (updated: FaseData[]) => void;
  children: React.ReactNode;
}

function PresentatieCollapsible({
  fase,
  isOpen,
  onToggle,
  extraPresentaties,
  addExtraPresentatie,
  onUpdateExtraPresentaties,
  children,
}: PresentatieCollapsibleProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
      >
        <span className="font-medium text-sm">{faseLabels[fase]}</span>
        <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-4 pb-4 overflow-visible">
          {children}

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
                      onUpdateExtraPresentaties(updated);
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
                      onUpdateExtraPresentaties(updated);
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
                    onUpdateExtraPresentaties(updated);
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="selmore" id={`extra-${index}-selmore`} />
                    <Label htmlFor={`extra-${index}-selmore`} className="text-sm cursor-pointer">Bij Selmore</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="klant" id={`extra-${index}-klant`} />
                    <Label htmlFor={`extra-${index}-klant`} className="text-sm cursor-pointer">Bij klant</Label>
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
        </div>
      )}
    </div>
  );
}

// --- Main component ---

export function ProductieFases({ data, onChange }: ProductieFasesProps) {
  const { data: employees = [] } = useEmployees();
  const [openFases, setOpenFases] = useState<Record<string, boolean>>({});

  const toggleFase = (fase: string) => {
    setOpenFases(prev => ({ ...prev, [fase]: !prev[fase] }));
  };

  const toggleProjectTeamMember = (empId: string) => {
    const isSelected = data.projectTeamIds.includes(empId);
    const newTeamIds = isSelected
      ? data.projectTeamIds.filter(id => id !== empId)
      : [...data.projectTeamIds, empId];

    const updatedFases = { ...data.fases };
    Object.keys(updatedFases).forEach(faseKey => {
      const fase = updatedFases[faseKey];
      const currentMedewerkers = fase?.medewerkers || [];

      if (isSelected) {
        updatedFases[faseKey] = {
          ...fase,
          medewerkers: currentMedewerkers.filter(id => id !== empId)
        };
      } else {
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

  const toggleMedewerker = (fase: string, empId: string) => {
    const currentList = data.fases[fase]?.medewerkers || [];
    const isSelected = currentList.includes(empId);
    const updated = isSelected
      ? currentList.filter(id => id !== empId)
      : [...currentList, empId];
    updateFase(fase, 'medewerkers', updated);
  };

  const addMedewerker = (fase: string, empId: string) => {
    const currentList = data.fases[fase]?.medewerkers || [];
    updateFase(fase, 'medewerkers', [...currentList, empId]);
  };

  const renderWerkFase = (fase: string) => {
    const dateRange: DateRange | undefined = data.fases[fase]?.startDatum || data.fases[fase]?.eindDatum
      ? {
          from: parseDate(data.fases[fase]?.startDatum),
          to: parseDate(data.fases[fase]?.eindDatum),
        }
      : undefined;

    return (
      <div className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Periode</Label>
            <DateRangePicker
              value={dateRange}
              onChange={(range) => {
                updateFase(fase, 'startDatum', formatDate(range?.from));
                updateFase(fase, 'eindDatum', formatDate(range?.to));
              }}
              placeholder="Start - eind"
            />
          </div>
          <div>
            <Label className="text-sm">Uren</Label>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={data.fases[fase]?.urenPerDag ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  updateFase(fase, 'urenPerDag', val === '' ? '' : parseFloat(val));
                }
              }}
              className="w-full"
              placeholder="0"
            />
          </div>
        </div>
        <MedewerkerSelectie
          selectedIds={data.fases[fase]?.medewerkers || []}
          employees={employees}
          onToggleMedewerker={(empId) => toggleMedewerker(fase, empId)}
          onAddMedewerker={(empId) => addMedewerker(fase, empId)}
        />
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
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="selmore" id={`${fase}-selmore`} />
            <Label htmlFor={`${fase}-selmore`} className="text-sm cursor-pointer">Bij Selmore</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="klant" id={`${fase}-klant`} />
            <Label htmlFor={`${fase}-klant`} className="text-sm cursor-pointer">Bij klant</Label>
          </div>
        </RadioGroup>
      </div>
      <MedewerkerSelectie
        selectedIds={data.fases[fase]?.medewerkers || []}
        employees={employees}
        onToggleMedewerker={(empId) => toggleMedewerker(fase, empId)}
        onAddMedewerker={(empId) => addMedewerker(fase, empId)}
      />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Projectteam */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Projectteam</h2>
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
      <div className="rounded-2xl border border-border bg-card p-6 space-y-2 overflow-visible">
        <h2 className="text-lg font-semibold text-foreground mb-4">Fases</h2>

        <ProductieTimeline fases={data.fases} />

        <FaseCollapsible fase="pp" isOpen={openFases['pp'] || false} onToggle={() => toggleFase('pp')}>
          {renderWerkFase('pp')}
        </FaseCollapsible>
        <FaseCollapsible fase="ppm" isOpen={openFases['ppm'] || false} onToggle={() => toggleFase('ppm')}>
          {renderMeetingFase('ppm')}
        </FaseCollapsible>
        <FaseCollapsible fase="shoot" isOpen={openFases['shoot'] || false} onToggle={() => toggleFase('shoot')}>
          {renderWerkFase('shoot')}
        </FaseCollapsible>
        <FaseCollapsible fase="offlineEdit" isOpen={openFases['offlineEdit'] || false} onToggle={() => toggleFase('offlineEdit')}>
          {renderWerkFase('offlineEdit')}
        </FaseCollapsible>
        <FaseCollapsible fase="presentatieOffline" isOpen={openFases['presentatieOffline'] || false} onToggle={() => toggleFase('presentatieOffline')}>
          {renderMeetingFase('presentatieOffline')}
        </FaseCollapsible>
        <FaseCollapsible fase="reEdit" isOpen={openFases['reEdit'] || false} onToggle={() => toggleFase('reEdit')}>
          {renderWerkFase('reEdit')}
        </FaseCollapsible>
        <FaseCollapsible fase="presentatieReEdit" isOpen={openFases['presentatieReEdit'] || false} onToggle={() => toggleFase('presentatieReEdit')}>
          {renderMeetingFase('presentatieReEdit')}
        </FaseCollapsible>
        <FaseCollapsible fase="onlineGrading" isOpen={openFases['onlineGrading'] || false} onToggle={() => toggleFase('onlineGrading')}>
          {renderWerkFase('onlineGrading')}
        </FaseCollapsible>
        <FaseCollapsible fase="geluid" isOpen={openFases['geluid'] || false} onToggle={() => toggleFase('geluid')}>
          {renderWerkFase('geluid')}
        </FaseCollapsible>
        <PresentatieCollapsible
          fase="presentatieFinals"
          isOpen={openFases['presentatieFinals'] || false}
          onToggle={() => toggleFase('presentatieFinals')}
          extraPresentaties={data.extraPresentaties}
          addExtraPresentatie={addExtraPresentatie}
          onUpdateExtraPresentaties={(updated) => onChange({ ...data, extraPresentaties: updated })}
        >
          {renderMeetingFase('presentatieFinals')}
        </PresentatieCollapsible>
        <FaseCollapsible fase="deliverables" isOpen={openFases['deliverables'] || false} onToggle={() => toggleFase('deliverables')}>
          {renderWerkFase('deliverables')}
        </FaseCollapsible>
      </div>
    </div>
  );
}

export const emptyProductieFasesData: ProductieFasesData = {
  projectTeamIds: [],
  fases: {
    pp: { enabled: false, dagen: 2, urenPerDag: 1, medewerkers: [] },
    ppm: { enabled: false, datumTijd: '', locatie: 'selmore', reistijd: false, medewerkers: [] },
    shoot: { enabled: false, dagen: 1, urenPerDag: 8, medewerkers: [] },
    offlineEdit: { enabled: false, dagen: 2, urenPerDag: 8, medewerkers: [] },
    presentatieOffline: { enabled: false, datumTijd: '', locatie: 'selmore', reistijd: false, medewerkers: [] },
    reEdit: { enabled: false, dagen: 1, urenPerDag: 8, medewerkers: [] },
    presentatieReEdit: { enabled: false, datumTijd: '', locatie: 'selmore', reistijd: false, medewerkers: [] },
    onlineGrading: { enabled: false, dagen: 2, urenPerDag: 8, medewerkers: [] },
    geluid: { enabled: false, dagen: 2, urenPerDag: 8, medewerkers: [] },
    presentatieFinals: { enabled: false, datumTijd: '', locatie: 'selmore', reistijd: false, medewerkers: [] },
    deliverables: { enabled: false, dagen: 1, urenPerDag: 8, medewerkers: [] },
  },
  extraPresentaties: [],
  deadlineOplevering: '',
};
