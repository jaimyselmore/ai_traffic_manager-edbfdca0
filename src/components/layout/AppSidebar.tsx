import { LayoutDashboard, Calendar, CalendarSync, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockEmployees } from '@/lib/mockData';

type Tab = 'overzicht' | 'planner' | 'agendas';

interface AppSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  selectedEmployee: string;
  onEmployeeChange: (employeeId: string) => void;
}

const navItems = [
  { id: 'overzicht' as const, label: 'Overzicht', icon: LayoutDashboard },
  { id: 'planner' as const, label: 'Planner', icon: Calendar },
  { id: 'agendas' as const, label: "Agenda's", icon: CalendarSync },
];

export function AppSidebar({ activeTab, onTabChange, selectedEmployee, onEmployeeChange }: AppSidebarProps) {
  const currentEmployee = mockEmployees.find(emp => emp.id === selectedEmployee);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <span className="text-lg font-bold text-primary-foreground">T</span>
        </div>
        <span className="text-xl font-semibold text-foreground">Traffic Tool</span>
      </div>

      {/* Employee Selector */}
      <div className="border-b border-border p-4">
        <label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Ingelogd als
        </label>
        <Select value={selectedEmployee} onValueChange={onEmployeeChange}>
          <SelectTrigger className="w-full">
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

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border p-4">
        <p className="text-xs text-muted-foreground text-center">
          © 2024 Traffic Tool
        </p>
      </div>
    </aside>
  );
}
