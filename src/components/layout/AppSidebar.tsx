import { LayoutDashboard, Calendar, CalendarSync, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type Tab = 'overzicht' | 'planner' | 'agendas' | 'ellen' | 'admin';

interface AppSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const navItems = [
  { id: 'overzicht' as const, label: 'Overzicht', icon: LayoutDashboard },
  { id: 'planner' as const, label: 'Planner', icon: Calendar },
  { id: 'agendas' as const, label: "Agenda's", icon: CalendarSync },
  { id: 'ellen' as const, label: 'Ellen', icon: Sparkles },
];

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full flex-col shrink-0 border-r border-border bg-card overflow-y-auto transition-all duration-300",
        isExpanded ? "w-64" : "w-16"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-3 justify-center">
        <div className="font-semibold text-lg text-foreground">E</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
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
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                    !isExpanded && 'justify-center'
                  )}
                  title={!isExpanded ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {isExpanded && <span>{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
