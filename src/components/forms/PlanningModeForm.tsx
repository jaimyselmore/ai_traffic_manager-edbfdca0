import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useEmployees } from '@/lib/data';

export type PlanningMode = 'ellen' | 'handmatig';

export interface MedewerkerEffort {
  medewerkerId: string;
  medewerkerNaam: string;
  effort: string;
  periodeStart?: string;
  periodeEind?: string;
}

export interface FaseData {
  enabled: boolean;
  medewerkers: MedewerkerEffort[];
  inspanning?: number; // Total days for the fase
}

export interface PresentatieMoment {
  id: string;
  type: string;
  voorkeursmoment: string;
  locatie: string;
  naam?: string;
  datum?: string;
  tijd?: string;
  medewerkers?: string[];
}

export interface PlanningModeData {
  mode: PlanningMode;
  conceptontwikkeling: FaseData;
  conceptuitwerking: FaseData;
  presentatiesEnabled: boolean;
  presentatieMomenten: PresentatieMoment[];
}

interface PlanningModeFormProps {
  data: PlanningModeData;
  onChange: (data: PlanningModeData) => void;
}

const DUUR_OPTIONS = [
  { value: '0.5', label: '0,5 dag' },
  { value: '1', label: '1 dag' },
  { value: '2', label: '2 dagen' },
  { value: '3', label: '3 dagen' },
  { value: '4', label: '4 dagen' },
  { value: '5+', label: '5+ dagen' },
];

const MEETING_TYPES = [
  { value: 'interne_review', label: 'Interne review' },
  { value: 'klantpresentatie', label: 'Klantpresentatie' },
  { value: 'feedbacksessie', label: 'Feedbacksessie' },
];

const VOORKEURSMOMENTEN = [
  { value: 'na_concept', label: 'Binnen 1 week na conceptontwikkeling' },
  { value: 'na_uitwerking', label: 'Binnen 1 week na conceptuitwerking' },
  { value: 'andere', label: 'Andere periode' },
];

const LOCATIES = [
  { value: 'selmore', label: 'Bij Selmore' },
  { value: 'online', label: 'Online' },
  { value: 'klant', label: 'Bij klant' },
];

export function PlanningModeForm({ data, onChange }: PlanningModeFormProps) {
  const { data: employees = [] } = useEmployees();

  const updateFase = (fase: 'conceptontwikkeling' | 'conceptuitwerking', updates: Partial<FaseData>) => {
    onChange({
      ...data,
      [fase]: { ...data[fase], ...updates },
    });
  };

  const toggleMedewerker = (fase: 'conceptontwikkeling' | 'conceptuitwerking', empId: string, empName: string) => {
    const current = data[fase].medewerkers;
    const exists = current.find(m => m.medewerkerId === empId);
    
    if (exists) {
      updateFase(fase, { medewerkers: current.filter(m => m.medewerkerId !== empId) });
    } else {
      updateFase(fase, { 
        medewerkers: [...current, { 
          medewerkerId: empId, 
          medewerkerNaam: empName, 
          effort: '' 
        }] 
      });
    }
  };

  const updateMedewerkerEffort = (
    fase: 'conceptontwikkeling' | 'conceptuitwerking', 
    empId: string, 
    updates: Partial<MedewerkerEffort>
  ) => {
    const current = data[fase].medewerkers;
    updateFase(fase, {
      medewerkers: current.map(m => 
        m.medewerkerId === empId ? { ...m, ...updates } : m
      )
    });
  };

  const addPresentatieMoment = () => {
    const newMoment: PresentatieMoment = {
      id: `pm-${Date.now()}`,
      type: '',
      voorkeursmoment: '',
      locatie: '',
      naam: '',
      datum: '',
      tijd: '',
      medewerkers: [],
    };
    onChange({
      ...data,
      presentatieMomenten: [...data.presentatieMomenten, newMoment],
    });
  };

  const updatePresentatieMoment = (id: string, updates: Partial<PresentatieMoment>) => {
    onChange({
      ...data,
      presentatieMomenten: data.presentatieMomenten.map(pm =>
        pm.id === id ? { ...pm, ...updates } : pm
      ),
    });
  };

  const removePresentatieMoment = (id: string) => {
    onChange({
      ...data,
      presentatieMomenten: data.presentatieMomenten.filter(pm => pm.id !== id),
    });
  };

  const togglePresentatieMedewerker = (momentId: string, medewerker: string) => {
    const moment = data.presentatieMomenten.find(pm => pm.id === momentId);
    if (!moment) return;
    const current = moment.medewerkers || [];
    const updated = current.includes(medewerker)
      ? current.filter(m => m !== medewerker)
      : [...current, medewerker];
    updatePresentatieMoment(momentId, { medewerkers: updated });
  };

  const renderFaseSection = (
    fase: 'conceptontwikkeling' | 'conceptuitwerking',
    label: string
  ) => {
    const faseData = data[fase];
    const isHandmatig = data.mode === 'handmatig';

    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id={`${fase}-enabled`}
            checked={faseData.enabled}
            onCheckedChange={(checked) => updateFase(fase, { enabled: !!checked })}
          />
          <Label htmlFor={`${fase}-enabled`} className="text-lg font-semibold cursor-pointer">
            {label}
          </Label>
        </div>

        {faseData.enabled && (
          <div className="pl-6 space-y-4">
            <div>
              <Label className="text-sm">Totale inspanning (dagen)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                className="w-32"
                value={faseData.inspanning || ''}
                onChange={(e) => updateFase(fase, { inspanning: parseInt(e.target.value) || undefined })}
                placeholder="Bijv. 2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dit is de totale duur van deze fase over alle medewerkers
              </p>
            </div>

            <div>
              <Label className="text-sm">Betrokken medewerkers</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {employees.map((emp) => (
                  <div key={emp.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`${fase}-emp-${emp.id}`}
                      checked={faseData.medewerkers.some(m => m.medewerkerId === emp.id)}
                      onCheckedChange={() => toggleMedewerker(fase, emp.id, emp.name)}
                    />
                    <Label htmlFor={`${fase}-emp-${emp.id}`} className="text-sm cursor-pointer">
                      {emp.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-medewerker effort table */}
            {faseData.medewerkers.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">Inspanning per medewerker</Label>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 font-medium">Medewerker</th>
                        <th className="text-left p-3 font-medium">Inspanning</th>
                        {isHandmatig && (
                          <th className="text-left p-3 font-medium">Periode</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {faseData.medewerkers.map((m) => (
                        <tr key={m.medewerkerId} className="border-t border-border">
                          <td className="p-3">{m.medewerkerNaam}</td>
                          <td className="p-3">
                            <Select
                              value={m.effort}
                              onValueChange={(value) => updateMedewerkerEffort(fase, m.medewerkerId, { effort: value })}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue placeholder="Selecteer" />
                              </SelectTrigger>
                              <SelectContent>
                                {DUUR_OPTIONS.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          {isHandmatig && (
                            <td className="p-3">
                              <div className="flex gap-2 items-center">
                                <Input
                                  type="date"
                                  className="w-36"
                                  value={m.periodeStart || ''}
                                  onChange={(e) => updateMedewerkerEffort(fase, m.medewerkerId, { periodeStart: e.target.value })}
                                />
                                <span className="text-muted-foreground">–</span>
                                <Input
                                  type="date"
                                  className="w-36"
                                  value={m.periodeEind || ''}
                                  onChange={(e) => updateMedewerkerEffort(fase, m.medewerkerId, { periodeEind: e.target.value })}
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Planning Mode Selection */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Planning door Ellen of handmatig</h2>
        
        <RadioGroup
          value={data.mode}
          onValueChange={(value) => onChange({ ...data, mode: value as PlanningMode })}
          className="space-y-3"
        >
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer">
            <RadioGroupItem value="ellen" id="mode-ellen" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="mode-ellen" className="font-medium cursor-pointer">
                Laat Ellen helpen met de planning
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Ellen maakt een voorstel op basis van je input. Jij keurt altijd alles zelf goed.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3 p-4 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer">
            <RadioGroupItem value="handmatig" id="mode-handmatig" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="mode-handmatig" className="font-medium cursor-pointer">
                Handmatig invullen
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Je geeft zelf per fase en medewerker aan wie wanneer hoeveel tijd nodig heeft.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Ellen mode description */}
      {data.mode === 'ellen' && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
          <p className="text-sm text-foreground">
            Ellen analyseert je input en stelt een planning voor op basis van beschikbaarheid, 
            ervaring en projecttype. Je kunt het voorstel altijd aanpassen voordat je het goedkeurt.
          </p>
        </div>
      )}

      {/* Phase sections */}
      {renderFaseSection('conceptontwikkeling', 'Conceptontwikkeling')}
      {renderFaseSection('conceptuitwerking', 'Conceptuitwerking')}

      {/* Presentatie / meetingmomenten */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id="presentaties-enabled"
            checked={data.presentatiesEnabled}
            onCheckedChange={(checked) => onChange({ ...data, presentatiesEnabled: !!checked })}
          />
          <Label htmlFor="presentaties-enabled" className="text-lg font-semibold cursor-pointer">
            Presentatie / meetingmomenten
          </Label>
        </div>

        {data.presentatiesEnabled && (
          <div className="pl-6 space-y-4">
            {data.presentatieMomenten.map((moment, index) => (
              <div key={moment.id} className="p-4 border border-border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Moment {index + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removePresentatieMoment(moment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {data.mode === 'handmatig' && (
                  <div>
                    <Label className="text-sm">Naam</Label>
                    <Input
                      value={moment.naam || ''}
                      onChange={(e) => updatePresentatieMoment(moment.id, { naam: e.target.value })}
                      placeholder="bijv. Eerste klantpresentatie"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-sm">Type</Label>
                  <Select
                    value={moment.type}
                    onValueChange={(value) => updatePresentatieMoment(moment.id, { type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer type" />
                    </SelectTrigger>
                    <SelectContent>
                      {MEETING_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {data.mode === 'ellen' ? (
                  <div>
                    <Label className="text-sm">Voorkeursmoment</Label>
                    <Select
                      value={moment.voorkeursmoment}
                      onValueChange={(value) => updatePresentatieMoment(moment.id, { voorkeursmoment: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer moment" />
                      </SelectTrigger>
                      <SelectContent>
                        {VOORKEURSMOMENTEN.map((vm) => (
                          <SelectItem key={vm.value} value={vm.value}>
                            {vm.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm">Datum</Label>
                      <Input
                        type="date"
                        value={moment.datum || ''}
                        onChange={(e) => updatePresentatieMoment(moment.id, { datum: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-sm">Tijd</Label>
                      <Input
                        type="time"
                        value={moment.tijd || ''}
                        onChange={(e) => updatePresentatieMoment(moment.id, { tijd: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-sm">Locatie</Label>
                  <Select
                    value={moment.locatie}
                    onValueChange={(value) => updatePresentatieMoment(moment.id, { locatie: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer locatie" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIES.map((loc) => (
                        <SelectItem key={loc.value} value={loc.value}>
                          {loc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {data.mode === 'handmatig' && (
                  <div>
                    <Label className="text-sm">Betrokken medewerkers</Label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {employees.map((emp) => (
                        <div key={emp.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`pres-${moment.id}-${emp.id}`}
                            checked={(moment.medewerkers || []).includes(emp.id)}
                            onCheckedChange={() => togglePresentatieMedewerker(moment.id, emp.id)}
                          />
                          <Label htmlFor={`pres-${moment.id}-${emp.id}`} className="text-sm cursor-pointer">
                            {emp.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              onClick={addPresentatieMoment}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Presentatiemoment toevoegen
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const emptyPlanningModeData: PlanningModeData = {
  mode: 'ellen',
  conceptontwikkeling: {
    enabled: false,
    medewerkers: [],
    inspanning: undefined,
  },
  conceptuitwerking: {
    enabled: false,
    medewerkers: [],
    inspanning: undefined,
  },
  presentatiesEnabled: false,
  presentatieMomenten: [],
};
