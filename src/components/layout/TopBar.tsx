import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockEmployees } from '@/lib/mockData';

interface TopBarProps {
  selectedEmployee: string;
  onEmployeeChange: (employeeId: string) => void;
}

export function TopBar({ selectedEmployee, onEmployeeChange }: TopBarProps) {
  const currentEmployee = mockEmployees.find(emp => emp.id === selectedEmployee);

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Ingelogd als</span>
        <Select value={selectedEmployee} onValueChange={onEmployeeChange}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Selecteer medewerker">
              {currentEmployee && (
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {currentEmployee.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span className="truncate">{currentEmployee.name}</span>
                </div>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {mockEmployees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {emp.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="font-medium">{emp.name}</div>
                    <div className="text-xs text-muted-foreground">{emp.role}</div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </header>
  );
}
