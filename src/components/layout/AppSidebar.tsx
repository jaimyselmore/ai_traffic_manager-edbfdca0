import { LayoutDashboard, Calendar, CalendarSync, Sparkles, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { EllenLogo } from './EllenLogo';

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
  const navigate = useNavigate();

  const handleAdminClick = () => {
    navigate('/admin');
  };

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

      {/* Admin link at bottom */}
      <div className="p-4 border-t border-border">
        <button
          onClick={handleAdminClick}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            'text-muted-foreground hover:bg-secondary hover:text-foreground'
          )}
        >
          <Settings className="h-5 w-5" />
          Instellingen
        </button>
      </div>
    </aside>
  );
}
