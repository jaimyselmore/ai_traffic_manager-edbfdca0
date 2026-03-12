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

function RobotFace({ happy, size = 28 }: { happy?: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="transition-all duration-300 shrink-0"
    >
      <line x1="32" y1="4" x2="32" y2="13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="4" r="3" fill="currentColor" />
      <rect x="10" y="13" width="44" height="36" rx="10" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5" />
      {happy ? (
        <>
          <path d="M20 27 Q24 23 28 27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <path d="M36 27 Q40 23 44 27" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <circle cx="24" cy="27" r="4" fill="currentColor" />
          <circle cx="40" cy="27" r="4" fill="currentColor" />
          <circle cx="26" cy="25" r="1.5" fill="white" fillOpacity="0.6" />
          <circle cx="42" cy="25" r="1.5" fill="white" fillOpacity="0.6" />
        </>
      )}
      {happy ? (
        <path d="M20 38 Q32 50 44 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      ) : (
        <path d="M23 38 Q32 45 41 38" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      )}
      {happy && (
        <>
          <ellipse cx="18" cy="38" rx="5" ry="3" fill="currentColor" fillOpacity="0.2" />
          <ellipse cx="46" cy="38" rx="5" ry="3" fill="currentColor" fillOpacity="0.2" />
        </>
      )}
      <rect x="22" y="49" width="20" height="5" rx="2.5" fill="currentColor" fillOpacity="0.3" />
    </svg>
  );
}

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
      {/* Logo — robot icoon + "Ellen" naam bij hover */}
      <div className="flex h-12 items-center border-b border-border px-3">
        <div className={cn(
          "flex items-center gap-2.5 text-primary transition-all duration-300 overflow-hidden",
          isExpanded ? "w-full" : "w-8"
        )}>
          <RobotFace happy={isExpanded} size={28} />
          {isExpanded && (
            <span className="font-semibold text-sm whitespace-nowrap animate-in fade-in slide-in-from-left-1 duration-200">
              Ellen
            </span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
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
