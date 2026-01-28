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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useEmployees } from '@/hooks/use-employees';
import { useVerlofTypes } from '@/lib/data';
import { useMemo } from 'react';

export interface VerlofFormData {
  medewerker: string;
  verlofType: string;
  verlofCategorie: 'gepland' | 'urgent' | '';
  startdatum: string;
  einddatum: string;
  backupPersoon?: string;
  reden: string;
}

interface VerlofFormProps {
  data: VerlofFormData;
  onChange: (data: VerlofFormData) => void;
}

export function VerlofForm({ data, onChange }: VerlofFormProps) {
  const { data: employees = [] } = useEmployees();
  const { data: verlofTypes = [] } = useVerlofTypes();

  const handleFieldChange = (field: keyof VerlofFormData, value: string | undefined) => {
    onChange({ ...data, [field]: value });
  };

  // Filter backup personen: same discipline as selected employee, exclude selected employee
  const selectedEmployee = useMemo(
    () => employees.find((emp) => emp.id === data.medewerker),
    [employees, data.medewerker]
  );

  const backupOptions = useMemo(
    () =>
      employees.filter(
        (emp) =>
          emp.id !== data.medewerker && emp.role === selectedEmployee?.role
      ),
    [employees, data.medewerker, selectedEmployee]
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="medewerker">Medewerker *</Label>
        <Select
          value={data.medewerker || ''}
          onValueChange={(value) => handleFieldChange('medewerker', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecteer medewerker" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.name} <span className="text-muted-foreground">({emp.role})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="verlofType">Type *</Label>
        <Select
          value={data.verlofType || ''}
          onValueChange={(value) => handleFieldChange('verlofType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecteer type" />
          </SelectTrigger>
          <SelectContent>
            {verlofTypes.map((type) => (
              <SelectItem key={type.id} value={type.id}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Categorie *</Label>
        <RadioGroup
          value={data.verlofCategorie}
          onValueChange={(value: 'gepland' | 'urgent') =>
            handleFieldChange('verlofCategorie', value)
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="gepland" id="gepland" />
            <Label htmlFor="gepland" className="text-sm font-normal cursor-pointer">
              Gepland verlof (vooraf aangevraagd)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="urgent" id="urgent" />
            <Label htmlFor="urgent" className="text-sm font-normal cursor-pointer">
              Urgent verlof (nu/vandaag)
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="startdatum">Startdatum *</Label>
          <Input
            id="startdatum"
            type="date"
            value={data.startdatum || ''}
            onChange={(e) => handleFieldChange('startdatum', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="einddatum">Einddatum *</Label>
          <Input
            id="einddatum"
            type="date"
            value={data.einddatum || ''}
            onChange={(e) => handleFieldChange('einddatum', e.target.value)}
          />
        </div>
      </div>

      {/* Backup persoon - alleen tonen als medewerker is geselecteerd */}
      {data.medewerker && backupOptions.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="backupPersoon">Backup persoon (optioneel)</Label>
          <Select
            value={data.backupPersoon || ''}
            onValueChange={(value) => handleFieldChange('backupPersoon', value || undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecteer backup" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Geen backup</SelectItem>
              {backupOptions.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name}{' '}
                  <span className="text-muted-foreground">({emp.role})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Ellen gebruikt dit als startpunt voor taak herverdeling
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reden">Reden / Toelichting</Label>
        <Textarea
          id="reden"
          placeholder="Optionele toelichting..."
          rows={3}
          value={data.reden || ''}
          onChange={(e) => handleFieldChange('reden', e.target.value)}
        />
      </div>
    </div>
  );
}
