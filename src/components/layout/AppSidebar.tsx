import { LayoutGrid, Calendar, CalendarSync } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type Tab = 'overzicht' | 'planner' | 'agendas' | 'admin';

interface AppSidebarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const navItems = [
  { id: 'overzicht' as const, label: 'Dashboard', icon: LayoutGrid },
  { id: 'planner' as const, label: 'Planner', icon: Calendar },
  { id: 'agendas' as const, label: "Agenda's", icon: CalendarSync },
];

export function AppSidebar({ activeTab, onTabChange }: AppSidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside
      className={cn(
        "flex h-full flex-col shrink-0 border-r border-border bg-card overflow-y-auto transition-all duration-300",
        isExpanded ? "w-56" : "w-14"
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Logo */}
      <div className="flex h-14 items-center justify-center border-b border-border">
        <div className={cn(
          "h-8 rounded-lg bg-primary flex items-center justify-center transition-all duration-300 overflow-hidden",
          isExpanded ? "w-[72px] px-2" : "w-8"
        )}>
          <span className={cn(
            "text-primary-foreground font-bold text-sm whitespace-nowrap transition-all duration-300",
            isExpanded ? "opacity-100" : "opacity-100"
          )}>
            {isExpanded ? "ELLEN" : "E"}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Don't show any tab as active when on admin page
            const isActive = activeTab !== 'admin' && activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabChange(item.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    !isExpanded && 'justify-center px-0'
                  )}
                  title={!isExpanded ? item.label : undefined}
                >
                  <Icon className={cn(
                    "h-[18px] w-[18px] shrink-0 transition-colors",
                    isActive ? "text-primary" : ""
                  )} strokeWidth={isActive ? 2 : 1.5} />
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
