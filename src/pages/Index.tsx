import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Planner } from '@/components/planner/Planner';
import { AgendasFlow } from '@/components/agendas/AgendasFlow';
import EllenChatPage from '@/pages/EllenChatPage';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'overzicht' | 'planner' | 'agendas' | 'ellen' | 'admin';

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam || 'overzicht');
  const { user } = useAuth();

  // Update tab when URL param changes
  useEffect(() => {
    if (tabParam && ['overzicht', 'planner', 'agendas', 'ellen', 'admin'].includes(tabParam)) {
      setActiveTab(tabParam);
      // Clear the param after reading it
      setSearchParams({}, { replace: true });
    }
  }, [tabParam, setSearchParams]);

  const renderContent = () => {
    switch (activeTab) {
      case 'overzicht':
        return <Dashboard selectedEmployeeId={user?.id || ''} />;
      case 'planner':
        return <Planner />;
      case 'agendas':
        return <AgendasFlow />;
      case 'ellen':
        return <EllenChatPage />;
      default:
        return <Dashboard selectedEmployeeId={user?.id || ''} />;
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-background">
      <AppSidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
      />
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;
