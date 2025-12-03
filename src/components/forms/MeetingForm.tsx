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

export interface MeetingFormData {
  klant: string;
  onderwerp: string;
  meetingType: string;
  datum: string;
  starttijd: string;
  eindtijd: string;
  locatie: string;
  medewerkers: string[];
  opmerkingen: string;
}

interface MeetingFormProps {
  data: MeetingFormData;
  onChange: (data: MeetingFormData) => void;
}

export function MeetingForm({ data, onChange }: MeetingFormProps) {
  const handleFieldChange = (field: keyof MeetingFormData, value: string | string[]) => {
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
          <Label htmlFor="klant">Klant</Label>
          <Select
            value={data.klant || ''}
            onValueChange={(value) => handleFieldChange('klant', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecteer klant (optioneel)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="intern">Intern (geen klant)</SelectItem>
              {mockClients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="meetingType">Type *</Label>
          <Select
            value={data.meetingType || ''}
            onValueChange={(value) => handleFieldChange('meetingType', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecteer type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="presentatie">Presentatie</SelectItem>
              <SelectItem value="brainstorm">Brainstorm</SelectItem>
              <SelectItem value="review">Review</SelectItem>
              <SelectItem value="kickoff">Kickoff</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="onderwerp">Onderwerp *</Label>
        <Input
          id="onderwerp"
          placeholder="Bijv. Q1 campagne presentatie"
          value={data.onderwerp || ''}
          onChange={(e) => handleFieldChange('onderwerp', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="datum">Datum *</Label>
          <Input
            id="datum"
            type="date"
            value={data.datum || ''}
            onChange={(e) => handleFieldChange('datum', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="starttijd">Starttijd *</Label>
          <Input
            id="starttijd"
            type="time"
            value={data.starttijd || ''}
            onChange={(e) => handleFieldChange('starttijd', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="eindtijd">Eindtijd *</Label>
          <Input
            id="eindtijd"
            type="time"
            value={data.eindtijd || ''}
            onChange={(e) => handleFieldChange('eindtijd', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="locatie">Locatie</Label>
        <Input
          id="locatie"
          placeholder="Bijv. Vergaderruimte A, Teams, of extern adres"
          value={data.locatie || ''}
          onChange={(e) => handleFieldChange('locatie', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Deelnemers *</Label>
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
        <Label htmlFor="opmerkingen">Opmerkingen / Agenda</Label>
        <Textarea
          id="opmerkingen"
          placeholder="Voeg een agenda of extra informatie toe..."
          rows={4}
          value={data.opmerkingen || ''}
          onChange={(e) => handleFieldChange('opmerkingen', e.target.value)}
        />
      </div>
    </div>
  );
}
