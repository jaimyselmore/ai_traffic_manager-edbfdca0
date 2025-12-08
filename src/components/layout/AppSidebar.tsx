import { LayoutDashboard, Calendar, CalendarSync } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EllenLogo } from './EllenLogo';

type Tab = 'overzicht' | 'planner' | 'agendas';

interface AppSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const navItems = [
  { id: 'overzicht' as const, label: 'Overzicht', icon: LayoutDashboard },
  { id: 'planner' as const, label: 'Planner', icon: Calendar },
  { id: 'agendas' as const, label: "Agenda's", icon: CalendarSync },
];

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  return (
    <aside className="flex h-full w-64 flex-col shrink-0 border-r border-border bg-card overflow-y-auto">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-6">
        <EllenLogo />
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
    </aside>
  );
}
