import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Planner } from '@/components/planner/Planner';
import { AgendasFlow } from '@/components/agendas/AgendasFlow';
import { EllenChatWidget } from '@/components/chat/EllenChatWidget';
import { useAuth } from '@/contexts/AuthContext';

type Tab = 'overzicht' | 'planner' | 'agendas' | 'admin';

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabParam || 'overzicht');
  const { user } = useAuth();

  // Sync activeTab when URL param changes (e.g. direct navigation or refresh)
  useEffect(() => {
    const validTabs: Tab[] = ['overzicht', 'planner', 'agendas', 'admin'];
    if (tabParam && validTabs.includes(tabParam)) {
      setActiveTab(tabParam);
    } else if (!tabParam) {
      setActiveTab('overzicht');
    }
  }, [tabParam]);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'overzicht') {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overzicht':
        return <Dashboard selectedEmployeeId={user?.id || ''} />;
      case 'planner':
        return <Planner />;
      case 'agendas':
        return <AgendasFlow />;
      default:
        return <Dashboard selectedEmployeeId={user?.id || ''} />;
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-background">
      <AppSidebar
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-6 pt-4 pb-6">
          {renderContent()}
        </main>
      </div>

      {/* Ellen Chat Widget - floating bottom right */}
      <EllenChatWidget />
    </div>
  );
};

export default Index;
