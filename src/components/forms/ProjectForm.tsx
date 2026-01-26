import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { useEmployees } from '@/hooks/use-employees';
import { useClients } from '@/hooks/use-clients';
import {
  useProjectTypes,
  useIndicatievePeriodes,
  useEffortEenheden,
  usePrioriteiten,
} from '@/lib/data';

export interface ProjectFormData {
  klant: string;
  projectnaam: string;
  projectType: string;
  deliverables: string;
  deadline: string;
  deadlineOnbekend: boolean;
  indicatievePeriode: string;
  geschatteEffortWaarde: string;
  geschatteEffortEenheid: string;
  letEllenKiezen: boolean;
  medewerkers: string[];
  prioriteit: string;
  opmerkingen: string;
}

interface ProjectFormProps {
  data: ProjectFormData;
  onChange: (data: ProjectFormData) => void;
  errors?: Record<string, string>;
}

function AvailabilityDot({ availability }: { availability: 'available' | 'busy' | 'full' }) {
  const colors = {
    available: 'bg-green-500',
    busy: 'bg-orange-500',
    full: 'bg-red-500',
  };
  const labels = {
    available: 'Ruim beschikbaar',
    busy: 'Bijna vol',
    full: 'Volledig geboekt',
  };
  return (
    <span
      className={cn('inline-block w-2 h-2 rounded-full ml-2', colors[availability])}
      title={labels[availability]}
    />
  );
}

export function ProjectForm({ data, onChange, errors = {} }: ProjectFormProps) {
  // Fetch configurable data from data layer
  const { data: employees = [] } = useEmployees();
  const { data: clients = [] } = useClients();
  const { data: projectTypes = [] } = useProjectTypes();
  const { data: indicatievePeriodes = [] } = useIndicatievePeriodes();
  const { data: effortEenheden = [] } = useEffortEenheden();
  const { data: prioriteiten = [] } = usePrioriteiten();

  const handleFieldChange = (field: keyof ProjectFormData, value: string | string[] | boolean) => {
    onChange({ ...data, [field]: value });
  };

  const handleMedewerkerToggle = (empId: string) => {
    const current = data.medewerkers || [];
    const updated = current.includes(empId)
      ? current.filter((id) => id !== empId)
      : [...current, empId];
    handleFieldChange('medewerkers', updated);
  };

  const isDeadlineShort = useMemo(() => {
    if (!data.deadline || data.deadlineOnbekend) return false;
    const deadlineDate = new Date(data.deadline);
    const today = new Date();
    const diffDays = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays < 7 && diffDays >= 0;
  }, [data.deadline, data.deadlineOnbekend]);

  const projectnaamLength = (data.projectnaam || '').length;

  return (
    <div className="space-y-6">
      {/* Section: Project details */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">Project details</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="klant">
              Klant <span className="text-red-500">*</span>
            </Label>
            <Select
              value={data.klant || ''}
              onValueChange={(value) => handleFieldChange('klant', value)}
            >
              <SelectTrigger className={cn(errors.klant && 'border-red-500')}>
                <SelectValue placeholder="Selecteer klant" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.klant && <p className="text-xs text-red-500">{errors.klant}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectnaam">
              Projectnaam <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="projectnaam"
                placeholder="Bijv. Zomercampagne 2025"
                value={data.projectnaam || ''}
                onChange={(e) => handleFieldChange('projectnaam', e.target.value.slice(0, 100))}
                maxLength={100}
                className={cn(errors.projectnaam && 'border-red-500')}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {projectnaamLength}/100
              </span>
            </div>
            {errors.projectnaam && <p className="text-xs text-red-500">{errors.projectnaam}</p>}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectType">
            Project type <span className="text-red-500">*</span>
          </Label>
          <Select
            value={data.projectType || ''}
            onValueChange={(value) => handleFieldChange('projectType', value)}
          >
            <SelectTrigger className={cn(errors.projectType && 'border-red-500')}>
              <SelectValue placeholder="Selecteer type" />
            </SelectTrigger>
            <SelectContent>
              {projectTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Helpt Ellen inschatten welke disciplines en uren nodig zijn
          </p>
          {errors.projectType && <p className="text-xs text-red-500">{errors.projectType}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="deliverables">
            Deliverables / Format <span className="text-red-500">*</span>
          </Label>
          <Input
            id="deliverables"
            placeholder="Bijv. Social media campagne, video, poster, website banner"
            value={data.deliverables || ''}
            onChange={(e) => handleFieldChange('deliverables', e.target.value)}
            className={cn(errors.deliverables && 'border-red-500')}
          />
          {errors.deliverables && <p className="text-xs text-red-500">{errors.deliverables}</p>}
        </div>
      </div>

      {/* Section: Planning */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">Planning</h2>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="deadlineOnbekend"
              checked={data.deadlineOnbekend || false}
              onCheckedChange={(checked) => handleFieldChange('deadlineOnbekend', !!checked)}
            />
            <label htmlFor="deadlineOnbekend" className="text-sm cursor-pointer">
              Deadline is nog niet bekend
            </label>
          </div>

          {!data.deadlineOnbekend ? (
            <div className="space-y-2">
              <Label htmlFor="deadline">
                Deadline <span className="text-red-500">*</span>
              </Label>
              <Input
                id="deadline"
                type="date"
                value={data.deadline || ''}
                onChange={(e) => handleFieldChange('deadline', e.target.value)}
                className={cn(errors.deadline && 'border-red-500')}
              />
              {isDeadlineShort && (
                <p className="text-xs text-amber-600 font-medium">
                  ⚠️ Let op: zeer korte deadline
                </p>
              )}
              {errors.deadline && <p className="text-xs text-red-500">{errors.deadline}</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="indicatievePeriode">Indicatieve periode</Label>
              <Select
                value={data.indicatievePeriode || ''}
                onValueChange={(value) => handleFieldChange('indicatievePeriode', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer periode" />
                </SelectTrigger>
                <SelectContent>
                  {indicatievePeriodes.map((periode) => (
                    <SelectItem key={periode.id} value={periode.id}>
                      {periode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Geschatte effort (optioneel)</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Bijv. 80"
              value={data.geschatteEffortWaarde || ''}
              onChange={(e) => handleFieldChange('geschatteEffortWaarde', e.target.value.replace(/\D/g, ''))}
              className="w-24"
              type="text"
              inputMode="numeric"
            />
            <Select
              value={data.geschatteEffortEenheid || 'uren'}
              onValueChange={(value) => handleFieldChange('geschatteEffortEenheid', value)}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {effortEenheden.map((eenheid) => (
                  <SelectItem key={eenheid.id} value={eenheid.id}>
                    {eenheid.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Niet zeker? Ellen kan dit schatten o.b.v. project type
          </p>
        </div>

        <div className="space-y-2">
          <Label>Prioriteit</Label>
          <RadioGroup
            value={data.prioriteit || 'normaal'}
            onValueChange={(value) => handleFieldChange('prioriteit', value)}
            className="flex gap-6"
          >
            {prioriteiten.map((prio) => (
              <div key={prio.id} className="flex items-center space-x-2">
                <RadioGroupItem value={prio.id} id={`prio-${prio.id}`} />
                <Label htmlFor={`prio-${prio.id}`} className="cursor-pointer font-normal">
                  {prio.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Section: Team */}
      <div className="bg-muted/30 rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground mb-2">Team</h2>

        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="letEllenKiezen"
              checked={data.letEllenKiezen || false}
              onCheckedChange={(checked) => handleFieldChange('letEllenKiezen', !!checked)}
            />
            <label htmlFor="letEllenKiezen" className="text-sm cursor-pointer font-medium">
              Laat Ellen het team kiezen
            </label>
          </div>

          <div className={cn(
            'grid grid-cols-2 gap-3 rounded-lg border border-input p-4',
            data.letEllenKiezen && 'opacity-50 pointer-events-none'
          )}>
            {employees.map((emp) => (
              <div key={emp.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`emp-${emp.id}`}
                  checked={(data.medewerkers || []).includes(emp.id)}
                  onCheckedChange={() => handleMedewerkerToggle(emp.id)}
                  disabled={data.letEllenKiezen}
                />
                <label
                  htmlFor={`emp-${emp.id}`}
                  className="text-sm text-foreground cursor-pointer flex items-center"
                >
                  {emp.name}
                  <span className="text-muted-foreground ml-1">({emp.role})</span>
                  <AvailabilityDot availability={emp.availability} />
                </label>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" /> Ruim beschikbaar
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Bijna vol
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Volledig geboekt
            </span>
          </div>
        </div>
      </div>

      {/* Opmerkingen */}
      <div className="space-y-2">
        <Label htmlFor="opmerkingen">Opmerkingen</Label>
        <Textarea
          id="opmerkingen"
          placeholder="Extra informatie, specifieke wensen of context voor het project..."
          rows={4}
          value={data.opmerkingen || ''}
          onChange={(e) => handleFieldChange('opmerkingen', e.target.value)}
        />
      </div>
    </div>
  );
}
