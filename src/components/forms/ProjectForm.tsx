import { useEffect } from 'react';
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

export interface ProjectFormData {
  klant: string;
  projectnaam: string;
  deliverables: string;
  deadline: string;
  medewerkers: string[];
  opmerkingen: string;
}

interface ProjectFormProps {
  data: ProjectFormData;
  onChange: (data: ProjectFormData) => void;
}

export function ProjectForm({ data, onChange }: ProjectFormProps) {
  const handleFieldChange = (field: keyof ProjectFormData, value: string | string[]) => {
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
          <Label htmlFor="projectnaam">Projectnaam *</Label>
          <Input
            id="projectnaam"
            placeholder="Bijv. Zomercampagne 2025"
            value={data.projectnaam || ''}
            onChange={(e) => handleFieldChange('projectnaam', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="deliverables">Deliverables / Format *</Label>
        <Input
          id="deliverables"
          placeholder="Bijv. Social media campagne, video, poster, website banner"
          value={data.deliverables || ''}
          onChange={(e) => handleFieldChange('deliverables', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="deadline">Deadline *</Label>
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
          placeholder="Extra informatie, specifieke wensen of context voor het project..."
          rows={4}
          value={data.opmerkingen || ''}
          onChange={(e) => handleFieldChange('opmerkingen', e.target.value)}
        />
      </div>
    </div>
  );
}
