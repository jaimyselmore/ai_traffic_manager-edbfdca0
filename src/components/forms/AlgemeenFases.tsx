import { useState } from 'react';
import { ChevronDown, Plus, X, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

export interface PresentatieMoment {
  id: string;
  naam: string;
  datum?: string;
  tijd?: string;
  locatie: 'selmore' | 'klant' | '';
  teamIds: string[]; // Medewerker IDs voor deze presentatie
}

export interface AlgemeenFasesData {
  projectTeamIds: string[]; // Basis projectteam
  presentaties: PresentatieMoment[];
}

interface AlgemeenFasesProps {
  data: AlgemeenFasesData;
  onChange: (data: AlgemeenFasesData) => void;
}

export function AlgemeenFases({ data, onChange }: AlgemeenFasesProps) {
  const { data: employees = [] } = useEmployees();
  const [openPresentaties, setOpenPresentaties] = useState<Record<string, boolean>>({});

  // Toggle medewerker in projectteam
  const toggleProjectTeamMember = (empId: string) => {
    const isSelected = data.projectTeamIds.includes(empId);
    const newTeamIds = isSelected
      ? data.projectTeamIds.filter(id => id !== empId)
      : [...data.projectTeamIds, empId];

    // Als iemand uit projectteam gaat, ook uit alle presentaties halen
    let updatedPresentaties = data.presentaties;
    if (isSelected) {
      updatedPresentaties = data.presentaties.map(p => ({
        ...p,
        teamIds: p.teamIds.filter(id => id !== empId)
      }));
    } else {
      // Als iemand aan projectteam wordt toegevoegd, voeg toe aan alle bestaande presentaties
      updatedPresentaties = data.presentaties.map(p => ({
        ...p,
        teamIds: [...p.teamIds, empId]
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
    const newPresentatie: PresentatieMoment = {
      id: crypto.randomUUID(),
      naam: '',
      datum: '',
      tijd: '',
      locatie: '',
      teamIds: [...data.projectTeamIds], // Start met volledige projectteam
    };
    const newPresentaties = [...data.presentaties, newPresentatie];
    onChange({ ...data, presentaties: newPresentaties });
    // Open de nieuwe presentatie automatisch
    setOpenPresentaties(prev => ({ ...prev, [newPresentatie.id]: true }));
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

  // Toggle medewerker in specifieke presentatie
  const togglePresentatieTeamMember = (presentatieId: string, empId: string) => {
    const presentatie = data.presentaties.find(p => p.id === presentatieId);
    if (!presentatie) return;

    const isSelected = presentatie.teamIds.includes(empId);
    const newTeamIds = isSelected
      ? presentatie.teamIds.filter(id => id !== empId)
      : [...presentatie.teamIds, empId];

    updatePresentatie(presentatieId, 'teamIds', newTeamIds);
  };

  // Voeg medewerker toe aan presentatie (die niet in projectteam zit)
  const addMemberToPresentatie = (presentatieId: string, empId: string) => {
    const presentatie = data.presentaties.find(p => p.id === presentatieId);
    if (!presentatie || presentatie.teamIds.includes(empId)) return;

    updatePresentatie(presentatieId, 'teamIds', [...presentatie.teamIds, empId]);
  };

  return (
    <div className="space-y-6">
      {/* Projectteam */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">Projectteam</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Selecteer het kernteam voor dit project. Dit team wordt automatisch aan alle presentaties toegevoegd.
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

      {/* Presentatiemomenten */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Presentatiemomenten</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Voeg presentaties/mijlpalen toe waar je naartoe werkt. Laat datum leeg om Ellen te laten bepalen.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPresentatie}
          >
            <Plus className="h-4 w-4 mr-1" />
            Presentatie
          </Button>
        </div>

        {data.presentaties.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Nog geen presentaties toegevoegd</p>
            <p className="text-xs mt-1">Ellen zal zelf presentatiemomenten voorstellen</p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.presentaties.map((presentatie, index) => {
              const isOpen = openPresentaties[presentatie.id] || false;

              return (
                <Collapsible
                  key={presentatie.id}
                  open={isOpen}
                  onOpenChange={(open) => setOpenPresentaties(prev => ({ ...prev, [presentatie.id]: open }))}
                >
                  <CollapsibleTrigger className="w-full flex items-center justify-between py-3 px-4 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
                    <span className="font-medium text-sm">
                      {presentatie.naam || `Presentatie ${index + 1}`}
                      {presentatie.datum && (
                        <span className="text-muted-foreground font-normal ml-2">
                          - {presentatie.datum}
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePresentatie(presentatie.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4 pt-4 space-y-4">
                    {/* Naam */}
                    <div>
                      <Label className="text-sm">Naam</Label>
                      <Input
                        value={presentatie.naam}
                        onChange={(e) => updatePresentatie(presentatie.id, 'naam', e.target.value)}
                        placeholder="Bijv. Conceptpresentatie, Tussenpresentatie..."
                        className="mt-1"
                      />
                    </div>

                    {/* Datum en tijd */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm">Datum</Label>
                        <p className="text-xs text-muted-foreground mb-1">Leeg = Ellen bepaalt</p>
                        <DatePicker
                          value={parseDate(presentatie.datum)}
                          onChange={(date) => updatePresentatie(presentatie.id, 'datum', formatDate(date))}
                          placeholder="Selecteer datum"
                        />
                      </div>
                      <div>
                        <Label className="text-sm">Tijd</Label>
                        <p className="text-xs text-muted-foreground mb-1">&nbsp;</p>
                        <Input
                          type="time"
                          value={presentatie.tijd || ''}
                          onChange={(e) => updatePresentatie(presentatie.id, 'tijd', e.target.value)}
                          className="h-10"
                        />
                      </div>
                    </div>

                    {/* Locatie */}
                    <div>
                      <Label className="text-sm mb-2 block">Locatie</Label>
                      <RadioGroup
                        value={presentatie.locatie || ''}
                        onValueChange={(value) => updatePresentatie(presentatie.id, 'locatie', value)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="selmore" id={`${presentatie.id}-selmore`} />
                            <Label htmlFor={`${presentatie.id}-selmore`} className="text-sm cursor-pointer">Bij Selmore</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value="klant" id={`${presentatie.id}-klant`} />
                            <Label htmlFor={`${presentatie.id}-klant`} className="text-sm cursor-pointer">Bij klant</Label>
                          </div>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Team voor deze presentatie */}
                    <div className="pt-4 border-t border-border">
                      <Label className="text-sm mb-2 block">Team voor deze presentatie</Label>
                      <div className="flex flex-wrap gap-2">
                        {/* Toon eerst mensen die in het team zitten */}
                        {presentatie.teamIds.map(empId => {
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
                                onClick={() => togglePresentatieTeamMember(presentatie.id, emp.id)}
                                className="ml-1 hover:bg-primary-foreground/20 rounded-full p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}

                        {/* Plus knop om iemand toe te voegen */}
                        <TeamMemberAddButton
                          presentatieId={presentatie.id}
                          currentTeamIds={presentatie.teamIds}
                          employees={employees}
                          onAdd={addMemberToPresentatie}
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Dropdown component voor het toevoegen van teamleden
function TeamMemberAddButton({
  presentatieId,
  currentTeamIds,
  employees,
  onAdd,
}: {
  presentatieId: string;
  currentTeamIds: string[];
  employees: { id: string; name: string; role: string }[];
  onAdd: (presentatieId: string, empId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const availableEmployees = employees.filter(e => !currentTeamIds.includes(e.id));

  if (availableEmployees.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-full border border-dashed border-border hover:bg-secondary transition-colors"
      >
        <Plus className="h-3 w-3" />
        <span>Toevoegen</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[180px] max-h-[200px] overflow-y-auto">
            {availableEmployees.map(emp => (
              <button
                key={emp.id}
                type="button"
                onClick={() => {
                  onAdd(presentatieId, emp.id);
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
