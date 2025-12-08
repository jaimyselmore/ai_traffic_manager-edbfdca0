import { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Planner } from '@/components/planner/Planner';
import { AgendasFlow } from '@/components/agendas/AgendasFlow';
import EllenChatPage from '@/pages/EllenChatPage';
import { mockEmployees } from '@/lib/mockData';

type Tab = 'overzicht' | 'planner' | 'agendas' | 'ellen';

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overzicht');
  const [selectedEmployee, setSelectedEmployee] = useState<string>(mockEmployees[0].id);

  const renderContent = () => {
    switch (activeTab) {
      case 'overzicht':
        return <Dashboard selectedEmployeeId={selectedEmployee} />;
      case 'planner':
        return <Planner />;
      case 'agendas':
        return <AgendasFlow />;
      case 'ellen':
        return <EllenChatPage />;
      default:
        return <Dashboard selectedEmployeeId={selectedEmployee} />;
    }
  };

  return (
    <div className="h-full flex overflow-hidden bg-background">
      <AppSidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
      />
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <TopBar
          selectedEmployee={selectedEmployee}
          onEmployeeChange={setSelectedEmployee}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;
