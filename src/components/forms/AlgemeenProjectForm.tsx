import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useEmployees } from '@/hooks/use-employees';
import { DatePicker } from '@/components/ui/date-picker';
import { format, parse, isValid } from 'date-fns';

// Helper functions voor datum conversie
const parseDate = (dateStr: string | undefined): Date | undefined => {
  if (!dateStr) return undefined;
  const isoDate = new Date(dateStr);
  if (isValid(isoDate)) return isoDate;
  const parsed = parse(dateStr, 'dd-MM-yyyy', new Date());
  return isValid(parsed) ? parsed : undefined;
};

const formatDateISO = (date: Date | undefined): string => {
  if (!date || !isValid(date)) return '';
  return format(date, 'yyyy-MM-dd');
};

export interface MeetingConfig {
  modus: 'ellen' | 'exact' | 'indicatie';
  aantalSuggestie?: number;
  exacteDatum?: string;
  exacteTijd?: string;
  indicatieDagen?: number;
}

export interface AlgemeenProjectData {
  scope: string;
  gewenstePeriodeStart: string;
  gewenstePeriodeEind: string;
  betrokkenRollen: string[];
  meetingConfig?: MeetingConfig;
}

interface AlgemeenProjectFormProps {
  data: AlgemeenProjectData;
  onChange: (data: AlgemeenProjectData) => void;
}

export function AlgemeenProjectForm({ data, onChange }: AlgemeenProjectFormProps) {
  const { data: employees = [] } = useEmployees();
  const uniqueRoles = [...new Set(employees.map(e => e.role))];

  const handleRolToggle = (rol: string) => {
    const newRollen = data.betrokkenRollen.includes(rol)
      ? data.betrokkenRollen.filter(r => r !== rol)
      : [...data.betrokkenRollen, rol];
    onChange({ ...data, betrokkenRollen: newRollen });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Projectdetails</h2>

      <div>
        <Label className="text-sm">Scope / Beschrijving *</Label>
        <Textarea
          value={data.scope}
          onChange={(e) => onChange({ ...data, scope: e.target.value })}
          placeholder="Beschrijf de scope en deliverables van het project..."
          rows={4}
        />
      </div>

      <div>
        <Label className="text-sm">Gewenste periode</Label>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <div>
            <Label className="text-xs text-muted-foreground">Start</Label>
            <Input
              type="date"
              value={data.gewenstePeriodeStart}
              onChange={(e) => onChange({ ...data, gewenstePeriodeStart: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Eind</Label>
            <Input
              type="date"
              value={data.gewenstePeriodeEind}
              onChange={(e) => onChange({ ...data, gewenstePeriodeEind: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div>
        <Label className="text-sm mb-3 block">Betrokken rollen</Label>
        <div className="grid grid-cols-2 gap-3">
          {uniqueRoles.map((rol) => (
            <div key={rol} className="flex items-center gap-2">
              <Checkbox
                id={`rol-${rol}`}
                checked={data.betrokkenRollen.includes(rol)}
                onCheckedChange={() => handleRolToggle(rol)}
              />
              <Label htmlFor={`rol-${rol}`} className="text-sm">{rol}</Label>
            </div>
          ))}
        </div>
      </div>

      {/* Meetings / Presentaties configuratie */}
      <div className="pt-4 border-t border-border">
        <Label className="text-sm mb-3 block">Meetings & Presentaties</Label>
        <RadioGroup
          value={data.meetingConfig?.modus || 'ellen'}
          onValueChange={(value) => onChange({
            ...data,
            meetingConfig: { ...data.meetingConfig, modus: value as 'ellen' | 'exact' | 'indicatie' }
          })}
          className="space-y-3"
        >
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30">
            <RadioGroupItem value="ellen" id="meeting-ellen" className="mt-1" />
            <div>
              <Label htmlFor="meeting-ellen" className="text-sm font-medium cursor-pointer">
                Ellen laten voorstellen
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ellen bepaalt het juiste aantal en moment op basis van projecttype
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30">
            <RadioGroupItem value="indicatie" id="meeting-indicatie" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="meeting-indicatie" className="text-sm font-medium cursor-pointer">
                Indicatie geven
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Geef aan hoeveel meetings je verwacht nodig te hebben
              </p>
              {data.meetingConfig?.modus === 'indicatie' && (
                <div className="mt-2">
                  <Input
                    type="number"
                    min="1"
                    max="10"
                    placeholder="Aantal meetings"
                    value={data.meetingConfig?.aantalSuggestie || ''}
                    onChange={(e) => onChange({
                      ...data,
                      meetingConfig: { ...data.meetingConfig, modus: 'indicatie', aantalSuggestie: parseInt(e.target.value) || undefined }
                    })}
                    className="w-32"
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30">
            <RadioGroupItem value="exact" id="meeting-exact" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="meeting-exact" className="text-sm font-medium cursor-pointer">
                Exacte datum en tijd opgeven
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Geef zelf de exacte datum en tijd op
              </p>
              {data.meetingConfig?.modus === 'exact' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Datum</Label>
                    <DatePicker
                      value={parseDate(data.meetingConfig?.exacteDatum)}
                      onChange={(date) => onChange({
                        ...data,
                        meetingConfig: { ...data.meetingConfig, modus: 'exact', exacteDatum: formatDateISO(date) }
                      })}
                      placeholder="Selecteer datum"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tijd</Label>
                    <Input
                      type="time"
                      value={data.meetingConfig?.exacteTijd || ''}
                      onChange={(e) => onChange({
                        ...data,
                        meetingConfig: { ...data.meetingConfig, modus: 'exact', exacteTijd: e.target.value }
                      })}
                      className="h-10"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

export const emptyAlgemeenProjectData: AlgemeenProjectData = {
  scope: '',
  gewenstePeriodeStart: '',
  gewenstePeriodeEind: '',
  betrokkenRollen: [],
  meetingConfig: { modus: 'ellen' },
};
