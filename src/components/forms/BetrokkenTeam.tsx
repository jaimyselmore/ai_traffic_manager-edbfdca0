import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useEmployees } from '@/lib/data';

export interface BetrokkenTeamData {
  betrokkenCreatie: boolean;
  creatieTeam: string;
  betrokkenAccount: boolean;
  accountVerantwoordelijke: string;
  betrokkenProductie: boolean;
  producer: string;
  ellenVoorstel: boolean;
}

interface BetrokkenTeamProps {
  data: BetrokkenTeamData;
  onChange: (data: BetrokkenTeamData) => void;
  showEllenToggle?: boolean;
  ellenDefaultOn?: boolean;
}

export function BetrokkenTeam({ data, onChange, showEllenToggle = true, ellenDefaultOn = false }: BetrokkenTeamProps) {
  const { data: employees = [] } = useEmployees();

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Betrokken team</h2>
      <p className="text-sm text-muted-foreground">
        Welke rollen zijn standaard aanwezig bij meetings en presentaties voor dit project?
      </p>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="creatie"
            checked={data.betrokkenCreatie}
            onCheckedChange={(checked) => onChange({ ...data, betrokkenCreatie: !!checked })}
          />
          <div className="flex-1">
            <Label htmlFor="creatie" className="text-sm font-medium">Creatie</Label>
            {data.betrokkenCreatie && (
              <Select
                value={data.creatieTeam}
                onValueChange={(value) => onChange({ ...data, creatieTeam: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecteer creatief duo/team" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => {
                    // Explicitly exclude studio team members by name
                    const studioNames = ['Martijn', 'Daniël', 'Jaimy'];
                    if (studioNames.includes(e.name)) {
                      return false;
                    }

                    const role = (e.role || '').toLowerCase();
                    const discipline = (e.discipline || '').toLowerCase();

                    // Check if discipline is creative-related
                    const isCreativeDiscipline =
                      discipline.includes('creatief') ||
                      discipline.includes('creative') ||
                      discipline.includes('concept');

                    // Check if role is creative-related
                    const isCreativeRole =
                      role.includes('creatief') ||
                      role.includes('creative') ||
                      role.includes('art director') ||
                      role.includes('copywriter') ||
                      role.includes('concept');

                    // Exclude studio/editor roles explicitly
                    const isStudioRole =
                      role.includes('editor') ||
                      role.includes('motion') ||
                      role.includes('designer') ||
                      role.includes('studio');

                    return (isCreativeDiscipline || isCreativeRole) && !isStudioRole;
                  }).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="account"
            checked={data.betrokkenAccount}
            onCheckedChange={(checked) => onChange({ ...data, betrokkenAccount: !!checked })}
          />
          <div className="flex-1">
            <Label htmlFor="account" className="text-sm font-medium">Account</Label>
            {data.betrokkenAccount && (
              <Select
                value={data.accountVerantwoordelijke}
                onValueChange={(value) => onChange({ ...data, accountVerantwoordelijke: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecteer accountverantwoordelijke" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => 
                    e.role.toLowerCase().includes('account') ||
                    e.role.toLowerCase().includes('project')
                  ).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="productie-team"
            checked={data.betrokkenProductie}
            onCheckedChange={(checked) => onChange({ ...data, betrokkenProductie: !!checked })}
          />
          <div className="flex-1">
            <Label htmlFor="productie-team" className="text-sm font-medium">Productie</Label>
            {data.betrokkenProductie && (
              <Select
                value={data.producer}
                onValueChange={(value) => onChange({ ...data, producer: value })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Selecteer producer" />
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => 
                    e.role.toLowerCase().includes('producer') || 
                    e.role.toLowerCase().includes('productie')
                  ).map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {showEllenToggle && (
        <div className="flex items-center gap-3 pt-4 border-t border-border mt-4">
          <Switch
            id="ellen-voorstel"
            checked={data.ellenVoorstel}
            onCheckedChange={(checked) => onChange({ ...data, ellenVoorstel: checked })}
          />
          <Label htmlFor="ellen-voorstel" className="text-sm">
            Laat Ellen een voorstel doen op basis van deze data
          </Label>
        </div>
      )}
    </div>
  );
}

export const emptyBetrokkenTeamData: BetrokkenTeamData = {
  betrokkenCreatie: false,
  creatieTeam: '',
  betrokkenAccount: false,
  accountVerantwoordelijke: '',
  betrokkenProductie: false,
  producer: '',
  ellenVoorstel: false,
};
