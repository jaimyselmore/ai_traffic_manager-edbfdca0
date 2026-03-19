import { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { MedewerkersTab } from '@/components/admin/WerknemersTab';
import { RolprofielenTab } from '@/components/admin/RolprofielenTab';
import { DisciplinesTab } from '@/components/admin/DisciplinesTab';
import { KlantenTab } from '@/components/admin/KlantenTab';
import { MicrosoftKoppelingTab } from '@/components/admin/MicrosoftKoppelingTab';
import { ProjectenTab } from '@/components/admin/ProjectenTab';
import { PlanningRegelsTab } from '@/components/admin/PlanningRegelsTab';
import { Users, Briefcase, Palette, Building2, Calendar, FolderOpen, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Tab = 'overzicht' | 'planner' | 'agendas' | 'ellen' | 'admin';

type AdminSection = {
  id: string;
  label: string;
  icon: typeof Users;
  description: string;
};

const sections: AdminSection[] = [
  { id: 'medewerkers', label: 'Medewerkers', icon: Users, description: 'Beheer teamleden en hun toegang' },
  { id: 'rollen', label: 'Rollen', icon: Briefcase, description: 'Configureer rollen en bevoegdheden' },
  { id: 'disciplines', label: 'Disciplines', icon: Palette, description: 'Vakgebieden en expertises' },
  { id: 'klanten', label: 'Klanten', icon: Building2, description: 'Klantgegevens en contacten' },
  { id: 'projecten', label: 'Projecten', icon: FolderOpen, description: 'Projectoverzicht en instellingen' },
  { id: 'planningregels', label: 'Planningregels', icon: BookOpen, description: 'Regels voor de AI-planner' },
  { id: 'microsoft', label: "Agenda's", icon: Calendar, description: 'Microsoft kalender koppelingen' },
];

export default function Admin() {
  const [activeSection, setActiveSection] = useState('medewerkers');
  const navigate = useNavigate();

  const handleTabChange = (tab: Tab) => {
    if (tab !== 'admin') {
      navigate('/');
    }
  };

  const current = sections.find(s => s.id === activeSection);

  return (
    <div className="h-full flex overflow-hidden bg-background">
      <AppSidebar
        activeTab="admin"
        onTabChange={handleTabChange}
      />
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          {/* Settings sidebar */}
          <nav className="w-52 flex-shrink-0 border-r border-border bg-muted/20 overflow-y-auto">
            <div className="px-4 py-4 border-b border-border">
              <h1 className="text-sm font-semibold text-foreground">Instellingen</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Referentiedata & configuratie</p>
            </div>
            <div className="p-2 space-y-0.5">
              {sections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-left transition-colors cursor-pointer',
                      isActive
                        ? 'bg-background text-foreground shadow-sm font-medium'
                        : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isActive && 'text-primary')} />
                    <span className="text-xs">{section.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content area */}
          <main className="flex-1 overflow-y-auto">
            <div className="px-6 py-4 border-b border-border bg-background">
              <h2 className="text-base font-semibold text-foreground">{current?.label}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{current?.description}</p>
            </div>
            <div className="px-6 py-5">
              {activeSection === 'medewerkers' && <MedewerkersTab />}
              {activeSection === 'rollen' && <RolprofielenTab />}
              {activeSection === 'disciplines' && <DisciplinesTab />}
              {activeSection === 'klanten' && <KlantenTab />}
              {activeSection === 'projecten' && <ProjectenTab />}
              {activeSection === 'planningregels' && <PlanningRegelsTab />}
              {activeSection === 'microsoft' && <MicrosoftKoppelingTab />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
