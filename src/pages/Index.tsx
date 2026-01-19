import { useState } from 'react';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Planner } from '@/components/planner/Planner';
import { AgendasFlow } from '@/components/agendas/AgendasFlow';
import EllenChatPage from '@/pages/EllenChatPage';
import { useAuth } from '@/contexts/AuthContext';
import { HeroSection } from '@/components/dashboard/HeroSection';

type Tab = 'overzicht' | 'planner' | 'agendas' | 'ellen' | 'admin';

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overzicht');
  const { user } = useAuth();

  const renderContent = () => {
    switch (activeTab) {
      case 'overzicht':
        return <Dashboard selectedEmployeeId={user?.id || ''} onTabChange={setActiveTab} />;
      case 'planner':
        return (
          <div className="relative space-y-8 px-6 pt-8 pb-12 max-w-7xl mx-auto">
            <Planner />
          </div>
        );
      case 'agendas':
        return (
          <div className="relative space-y-8 px-6 pt-8 pb-12 max-w-7xl mx-auto">
            <AgendasFlow />
          </div>
        );
      case 'ellen':
        return (
          <div className="relative space-y-8 px-6 pt-8 pb-12 max-w-7xl mx-auto">
            <EllenChatPage />
          </div>
        );
      default:
        return <Dashboard selectedEmployeeId={user?.id || ''} onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FE4836' }}>
      {activeTab !== 'overzicht' && <HeroSection onTabChange={setActiveTab} />}
      {renderContent()}
    </div>
  );
};

export default Index;
