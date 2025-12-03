import { mockEmployees, mockClients } from '@/lib/mockData';
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

export interface WijzigingsverzoekFormData {
  klant: string;
  projectnaam: string;
  wijzigingType: string;
  beschrijving: string;
  deadline: string;
  medewerkers: string[];
  opmerkingen: string;
}

interface WijzigingsverzoekFormProps {
  data: WijzigingsverzoekFormData;
  onChange: (data: WijzigingsverzoekFormData) => void;
}

export function WijzigingsverzoekForm({ data, onChange }: WijzigingsverzoekFormProps) {
  const handleFieldChange = (field: keyof WijzigingsverzoekFormData, value: string | string[]) => {
    onChange({ ...data, [field]: value });
  };

  const handleMedewerkerToggle = (empId: string) => {
    const current = data.medewerkers || [];
    const updated = current.includes(empId)
      ? current.filter((id) => id !== empId)
      : [...current, empId];
    handleFieldChange('medewerkers', updated);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="klant">Klant *</Label>
          <Select
            value={data.klant || ''}
            onValueChange={(value) => handleFieldChange('klant', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecteer klant" />
            </SelectTrigger>
            <SelectContent>
              {mockClients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="projectnaam">Bestaand project *</Label>
          <Input
            id="projectnaam"
            placeholder="Naam van het bestaande project"
            value={data.projectnaam || ''}
            onChange={(e) => handleFieldChange('projectnaam', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wijzigingType">Type wijziging *</Label>
        <Select
          value={data.wijzigingType || ''}
          onValueChange={(value) => handleFieldChange('wijzigingType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecteer type wijziging" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="content">Content aanpassing</SelectItem>
            <SelectItem value="design">Design wijziging</SelectItem>
            <SelectItem value="deadline">Deadline verschuiving</SelectItem>
            <SelectItem value="scope">Scope uitbreiding</SelectItem>
            <SelectItem value="anders">Anders</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="beschrijving">Beschrijving van de wijziging *</Label>
        <Textarea
          id="beschrijving"
          placeholder="Beschrijf wat er moet worden aangepast..."
          rows={4}
          value={data.beschrijving || ''}
          onChange={(e) => handleFieldChange('beschrijving', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deadline">Gewenste deadline</Label>
        <Input
          id="deadline"
          type="date"
          value={data.deadline || ''}
          onChange={(e) => handleFieldChange('deadline', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Betrokken medewerkers</Label>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-input p-4">
          {mockEmployees.map((emp) => (
            <div key={emp.id} className="flex items-center space-x-2">
              <Checkbox
                id={`emp-${emp.id}`}
                checked={(data.medewerkers || []).includes(emp.id)}
                onCheckedChange={() => handleMedewerkerToggle(emp.id)}
              />
              <label
                htmlFor={`emp-${emp.id}`}
                className="text-sm text-foreground cursor-pointer"
              >
                {emp.name} <span className="text-muted-foreground">({emp.role})</span>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="opmerkingen">Opmerkingen</Label>
        <Textarea
          id="opmerkingen"
          placeholder="Extra informatie of context..."
          rows={3}
          value={data.opmerkingen || ''}
          onChange={(e) => handleFieldChange('opmerkingen', e.target.value)}
        />
      </div>
    </div>
  );
}
