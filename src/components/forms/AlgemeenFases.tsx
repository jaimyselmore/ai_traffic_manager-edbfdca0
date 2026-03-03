import { useState } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { useEmployees } from '@/hooks/use-employees';
import { DatePicker } from '@/components/ui/date-picker';
import { format, parse, isValid } from 'date-fns';

// Helper functions voor datum conversie
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

export interface WorkloadMedewerker {
  medewerkerId: string;
  aantalDagen: number;
  urenPerDag: number;
}

export interface Workload {
  medewerkers: WorkloadMedewerker[];
}

export interface PresentatieMoment {
  id: string;
  naam: string;
  datumType: 'ellen' | 'zelf';
  datum?: string;
  tijd?: string;
  locatie: 'selmore' | 'klant' | '';
  teamIds: string[];
  workload: Workload;
}

export interface AlgemeenFasesData {
  projectTeamIds: string[];
  presentaties: PresentatieMoment[];
}

interface AlgemeenFasesProps {
  data: AlgemeenFasesData;
  onChange: (data: AlgemeenFasesData) => void;
}

export function AlgemeenFases({ data, onChange }: AlgemeenFasesProps) {
  const { data: employees = [] } = useEmployees();

  // Toggle medewerker in projectteam
  const toggleProjectTeamMember = (empId: string) => {
    const isSelected = data.projectTeamIds.includes(empId);
    const newTeamIds = isSelected
      ? data.projectTeamIds.filter(id => id !== empId)
      : [...data.projectTeamIds, empId];

    // Update alle presentaties
    let updatedPresentaties = data.presentaties;
    if (isSelected) {
      // Verwijder uit alle presentaties en workloads
      updatedPresentaties = data.presentaties.map(p => ({
        ...p,
        teamIds: p.teamIds.filter(id => id !== empId),
        workload: {
          ...p.workload,
          medewerkers: p.workload.medewerkers.filter(m => m.medewerkerId !== empId)
        }
      }));
    } else {
      // Voeg toe aan alle bestaande presentaties en workloads
      updatedPresentaties = data.presentaties.map(p => ({
        ...p,
        teamIds: [...p.teamIds, empId],
        workload: {
          ...p.workload,
          medewerkers: [...p.workload.medewerkers, { medewerkerId: empId, aantalDagen: 5, urenPerDag: 8 }]
        }
      }));
    }

    onChange({
      ...data,
      projectTeamIds: newTeamIds,
      presentaties: updatedPresentaties
    });
  };

  // Voeg nieuwe presentatie toe
  const addPresentatie = () => {
    const workloadMedewerkers: WorkloadMedewerker[] = data.projectTeamIds.map(id => ({
      medewerkerId: id,
      aantalDagen: 5,
      urenPerDag: 8,
    }));

    const newPresentatie: PresentatieMoment = {
      id: crypto.randomUUID(),
      naam: '',
      datumType: 'ellen',
      datum: '',
      tijd: '',
      locatie: '',
      teamIds: [...data.projectTeamIds],
      workload: {
        medewerkers: workloadMedewerkers,
      },
    };
    onChange({ ...data, presentaties: [...data.presentaties, newPresentatie] });
  };

  // Verwijder presentatie
  const removePresentatie = (id: string) => {
    onChange({
      ...data,
      presentaties: data.presentaties.filter(p => p.id !== id)
    });
  };

  // Update presentatie veld
  const updatePresentatie = (id: string, field: keyof PresentatieMoment, value: any) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === id ? { ...p, [field]: value } : p
      )
    });
  };

  // Toggle medewerker in specifieke presentatie team
  const togglePresentatieTeamMember = (presentatieId: string, empId: string) => {
    const presentatie = data.presentaties.find(p => p.id === presentatieId);
    if (!presentatie) return;

    const isSelected = presentatie.teamIds.includes(empId);
    const newTeamIds = isSelected
      ? presentatie.teamIds.filter(id => id !== empId)
      : [...presentatie.teamIds, empId];

    updatePresentatie(presentatieId, 'teamIds', newTeamIds);
  };

  // Workload functies
  const updateWorkloadMedewerker = (presentatieId: string, medewerkerId: string, field: 'aantalDagen' | 'urenPerDag', value: number) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId
          ? {
              ...p,
              workload: {
                ...p.workload,
                medewerkers: p.workload.medewerkers.map(m =>
                  m.medewerkerId === medewerkerId ? { ...m, [field]: value } : m
                )
              }
            }
          : p
      )
    });
  };

  const addWorkloadMedewerker = (presentatieId: string, empId: string) => {
    const presentatie = data.presentaties.find(p => p.id === presentatieId);
    if (!presentatie || presentatie.workload.medewerkers.some(m => m.medewerkerId === empId)) return;

    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId
          ? {
              ...p,
              workload: {
                ...p.workload,
                medewerkers: [...p.workload.medewerkers, { medewerkerId: empId, aantalDagen: 5, urenPerDag: 8 }]
              }
            }
          : p
      )
    });
  };

  const removeWorkloadMedewerker = (presentatieId: string, medewerkerId: string) => {
    onChange({
      ...data,
      presentaties: data.presentaties.map(p =>
        p.id === presentatieId
          ? {
              ...p,
              workload: {
                ...p.workload,
                medewerkers: p.workload.medewerkers.filter(m => m.medewerkerId !== medewerkerId)
              }
            }
          : p
      )
    });
  };

  return (
    <div className="space-y-4">
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

      {/* Presentaties - elk als apart blok */}
      {data.presentaties.map((presentatie, index) => (
        <div key={presentatie.id} className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-secondary/30 border-b border-border">
            <span className="font-semibold text-sm">
              {presentatie.naam || `Presentatie ${index + 1}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
              onClick={() => removePresentatie(presentatie.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="p-4 space-y-4">
            {/* Naam */}
            <div>
              <Label className="text-sm">Naam presentatie</Label>
              <Input
                value={presentatie.naam}
                onChange={(e) => updatePresentatie(presentatie.id, 'naam', e.target.value)}
                placeholder="Bijv. Conceptpresentatie"
                className="mt-1"
              />
            </div>

            {/* Datum type keuze */}
            <div>
              <Label className="text-sm mb-2 block">Datum & tijd</Label>
              <RadioGroup
                value={presentatie.datumType || 'ellen'}
                onValueChange={(value) => updatePresentatie(presentatie.id, 'datumType', value)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ellen" id={`${presentatie.id}-ellen`} />
                  <Label htmlFor={`${presentatie.id}-ellen`} className="text-sm cursor-pointer">Ellen bepaalt</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="zelf" id={`${presentatie.id}-zelf`} />
                  <Label htmlFor={`${presentatie.id}-zelf`} className="text-sm cursor-pointer">Zelf invullen</Label>
                </div>
              </RadioGroup>

              {presentatie.datumType === 'zelf' && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Datum</Label>
                    <DatePicker
                      value={parseDate(presentatie.datum)}
                      onChange={(date) => updatePresentatie(presentatie.id, 'datum', formatDate(date))}
                      placeholder="Selecteer datum"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tijd</Label>
                    <Input
                      type="time"
                      value={presentatie.tijd || ''}
                      onChange={(e) => updatePresentatie(presentatie.id, 'tijd', e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Locatie */}
            <div>
              <Label className="text-sm mb-2 block">Locatie</Label>
              <RadioGroup
                value={presentatie.locatie || ''}
                onValueChange={(value) => updatePresentatie(presentatie.id, 'locatie', value)}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="selmore" id={`${presentatie.id}-selmore`} />
                  <Label htmlFor={`${presentatie.id}-selmore`} className="text-sm cursor-pointer">Bij Selmore</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="klant" id={`${presentatie.id}-klant`} />
                  <Label htmlFor={`${presentatie.id}-klant`} className="text-sm cursor-pointer">Bij klant</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Team bij presentatie */}
            <div>
              <Label className="text-sm mb-2 block">Aanwezig bij presentatie</Label>
              <div className="flex flex-wrap gap-2">
                {presentatie.teamIds.map(empId => {
                  const emp = employees.find(e => e.id === empId);
                  if (!emp) return null;
                  return (
                    <div
                      key={emp.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full bg-primary text-primary-foreground"
                    >
                      <span>{emp.name}</span>
                      <button
                        type="button"
                        onClick={() => togglePresentatieTeamMember(presentatie.id, emp.id)}
                        className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                <MemberAddDropdown
                  currentIds={presentatie.teamIds}
                  employees={employees}
                  onAdd={(empId) => togglePresentatieTeamMember(presentatie.id, empId)}
                />
              </div>
            </div>
          </div>

          {/* Workload blok */}
          <div className="border-t border-border bg-muted/30 p-4">
            <Label className="text-sm font-medium mb-3 block">Workload (werk vooraf)</Label>

            <div className="space-y-2">
              {presentatie.workload.medewerkers.map(wm => {
                const emp = employees.find(e => e.id === wm.medewerkerId);
                if (!emp) return null;
                return (
                  <div key={wm.medewerkerId} className="flex items-center gap-3 bg-background rounded-lg p-3">
                    <span className="text-sm font-medium flex-1 min-w-0 truncate">{emp.name}</span>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="1"
                          value={wm.aantalDagen}
                          onChange={(e) => updateWorkloadMedewerker(presentatie.id, wm.medewerkerId, 'aantalDagen', parseInt(e.target.value) || 1)}
                          className="w-16 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">dagen</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0.5"
                          max="8"
                          step="0.5"
                          value={wm.urenPerDag}
                          onChange={(e) => updateWorkloadMedewerker(presentatie.id, wm.medewerkerId, 'urenPerDag', parseFloat(e.target.value) || 1)}
                          className="w-16 h-8 text-sm"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">u/dag</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWorkloadMedewerker(presentatie.id, wm.medewerkerId)}
                      className="p-1.5 hover:bg-destructive/10 hover:text-destructive rounded shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}

              <MemberAddDropdown
                currentIds={presentatie.workload.medewerkers.map(m => m.medewerkerId)}
                employees={employees}
                onAdd={(empId) => addWorkloadMedewerker(presentatie.id, empId)}
                label="Medewerker toevoegen"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Presentatie toevoegen knop */}
      <Button
        type="button"
        variant="outline"
        onClick={addPresentatie}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Presentatie toevoegen
      </Button>
    </div>
  );
}

// Reusable dropdown voor medewerker toevoegen
function MemberAddDropdown({
  currentIds,
  employees,
  onAdd,
  label = "Toevoegen",
}: {
  currentIds: string[];
  employees: { id: string; name: string; role: string }[];
  onAdd: (empId: string) => void;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const availableEmployees = employees.filter(e => !currentIds.includes(e.id));

  if (availableEmployees.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-dashed border-border hover:bg-secondary transition-colors"
      >
        <Plus className="h-3 w-3" />
        <span>{label}</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px]">
            {availableEmployees.map(emp => (
              <button
                key={emp.id}
                type="button"
                onClick={() => {
                  onAdd(emp.id);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors"
              >
                {emp.name}
                <span className="text-muted-foreground ml-1">({emp.role})</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const emptyAlgemeenFasesData: AlgemeenFasesData = {
  projectTeamIds: [],
  presentaties: [],
};
