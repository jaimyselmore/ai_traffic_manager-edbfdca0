import { useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { LayoutDashboard, Calendar, RefreshCw } from 'lucide-react';

interface AppLayoutProps {
  children: ReactNode;
  activeTab: 'overzicht' | 'planner' | 'outlook';
  onTabChange: (tab: 'overzicht' | 'planner' | 'outlook') => void;
}

const tabs = [
  { id: 'overzicht' as const, label: 'Overzicht', icon: LayoutDashboard },
  { id: 'planner' as const, label: 'Planner', icon: Calendar },
  { id: 'outlook' as const, label: 'Outlook synchronisatie', icon: RefreshCw },
];

export function AppLayout({ children, activeTab, onTabChange }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="flex h-16 items-center px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <span className="text-lg font-bold text-primary-foreground">T</span>
            </div>
            <span className="text-xl font-semibold text-foreground">Traffic Tool</span>
          </div>
          
          {/* Tab Navigation */}
          <nav className="ml-12 flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        {children}
      </main>
    </div>
  );
}
