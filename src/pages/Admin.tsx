import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HeroSection } from '@/components/dashboard/HeroSection';
import { WerknemersTab } from '@/components/admin/WerknemersTab';
import { RolprofielenTab } from '@/components/admin/RolprofielenTab';
import { DisciplinesTab } from '@/components/admin/DisciplinesTab';
import { KlantenTab } from '@/components/admin/KlantenTab';
import { Users, Briefcase, Palette, Building2 } from 'lucide-react';

export default function Admin() {
  const [activeTab, setActiveTab] = useState('werknemers');
  const navigate = useNavigate();

  const handleTabChange = (tab: 'overzicht' | 'planner' | 'agendas') => {
    navigate('/');
    // You could also set a URL param or use state to switch to the correct tab
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FE4836' }}>
      <HeroSection onTabChange={handleTabChange} />

      <main className="relative space-y-8 px-6 pt-8 pb-12 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Instellingen</h1>
          <p className="text-white/80">Beheer referentiedata voor de planning</p>
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
  );
}
