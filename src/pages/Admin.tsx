import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { WerknemersTab } from '@/components/admin/WerknemersTab';
import { RolprofielenTab } from '@/components/admin/RolprofielenTab';
import { DisciplinesTab } from '@/components/admin/DisciplinesTab';
import { KlantenTab } from '@/components/admin/KlantenTab';
import { Users, Briefcase, Palette, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type Tab = 'overzicht' | 'planner' | 'agendas' | 'ellen' | 'admin';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('werknemers');
  const navigate = useNavigate();

  const handleTabChange = (tab: Tab) => {
    if (tab !== 'admin') {
      navigate('/');
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-background">
      <AppSidebar
        activeTab="admin"
        onTabChange={handleTabChange}
      />
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Instellingen</h1>
            <p className="text-muted-foreground">Beheer referentiedata voor de planning</p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-2xl grid-cols-4">
              <TabsTrigger value="werknemers" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Werknemers
              </TabsTrigger>
              <TabsTrigger value="rollen" className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Rollen
              </TabsTrigger>
              <TabsTrigger value="disciplines" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Disciplines
              </TabsTrigger>
              <TabsTrigger value="klanten" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Klanten
              </TabsTrigger>
            </TabsList>

            <TabsContent value="werknemers" className="mt-6">
              <WerknemersTab />
            </TabsContent>

            <TabsContent value="rollen" className="mt-6">
              <RolprofielenTab />
            </TabsContent>

            <TabsContent value="disciplines" className="mt-6">
              <DisciplinesTab />
            </TabsContent>

            <TabsContent value="klanten" className="mt-6">
              <KlantenTab />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
