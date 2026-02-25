import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useEmployees } from '@/hooks/use-employees';

export interface BetrokkenTeamData {
  accountManagers: string[]; // IDs van account managers
  producers: string[]; // IDs van producers
  strategen: string[]; // IDs van strategen
  creatieTeam: string[]; // IDs van creatief team
  ellenVoorstel: boolean;
}

interface BetrokkenTeamProps {
  data: BetrokkenTeamData;
  onChange: (data: BetrokkenTeamData) => void;
  showEllenToggle?: boolean;
}

export function BetrokkenTeam({ data, onChange, showEllenToggle = true }: BetrokkenTeamProps) {
  const { data: employees = [] } = useEmployees();

  // Filter employees by role
  const accountEmployees = employees.filter(e => {
    const role = (e.role || '').toLowerCase();
    return role.includes('account') || role.includes('project manager');
  });

  const producerEmployees = employees.filter(e => {
    const role = (e.role || '').toLowerCase();
    return role.includes('producer') || role.includes('productie');
  });

  const strategEmployees = employees.filter(e => {
    const role = (e.role || '').toLowerCase();
    return role.includes('strateeg') || role.includes('strateg') || role.includes('strategy');
  });

  const creatieEmployees = employees.filter(e => {
    const studioNames = ['martijn', 'daniël', 'daniel', 'jaimy'];
    const nameLower = (e.name || '').toLowerCase();
    if (studioNames.some(studio => nameLower.includes(studio))) {
      return false;
    }

    const role = (e.role || '').toLowerCase();
    const discipline = (e.discipline || '').toLowerCase();

    const isCreativeDiscipline =
      discipline.includes('creatief') ||
      discipline.includes('creative') ||
      discipline.includes('concept');

    const isCreativeRole =
      role.includes('creatief') ||
      role.includes('creative') ||
      role.includes('art director') ||
      role.includes('copywriter') ||
      role.includes('concept');

    const isStudioRole =
      role.includes('editor') ||
      role.includes('motion') ||
      role.includes('designer') ||
      role.includes('studio');

    return (isCreativeDiscipline || isCreativeRole) && !isStudioRole;
  });

  const toggleEmployee = (field: keyof BetrokkenTeamData, empId: string) => {
    if (field === 'ellenVoorstel') return;
    const currentList = data[field] as string[];
    const isSelected = currentList.includes(empId);
    const updated = isSelected
      ? currentList.filter(id => id !== empId)
      : [...currentList, empId];
    onChange({ ...data, [field]: updated });
  };

  const RoleSection = ({
    title,
    field,
    employeeList,
    description
  }: {
    title: string;
    field: keyof BetrokkenTeamData;
    employeeList: typeof employees;
    description?: string;
  }) => {
    const selectedIds = (data[field] as string[]) || [];

    return (
      <div className="space-y-2">
        <Label className="text-sm font-medium">{title}</Label>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {employeeList.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Geen medewerkers met deze rol gevonden</p>
          ) : (
            employeeList.map(emp => {
              const isSelected = selectedIds.includes(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggleEmployee(field, emp.id)}
                  className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary/50 text-foreground border-border hover:bg-secondary'
                  }`}
                >
                  {emp.name}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Projectteam</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Selecteer wie bij dit project betrokken is. Deze personen worden automatisch uitgenodigd voor meetings en presentaties.
        </p>
      </div>

      <RoleSection
        title="Account Manager"
        field="accountManagers"
        employeeList={accountEmployees}
      />

      <RoleSection
        title="Producer"
        field="producers"
        employeeList={producerEmployees}
      />

      <RoleSection
        title="Strateeg"
        field="strategen"
        employeeList={strategEmployees}
      />

      <RoleSection
        title="Creatief team"
        field="creatieTeam"
        employeeList={creatieEmployees}
        description="Art Directors, Copywriters en andere creatieven"
      />

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
  accountManagers: [],
  producers: [],
  strategen: [],
  creatieTeam: [],
  ellenVoorstel: false,
};
