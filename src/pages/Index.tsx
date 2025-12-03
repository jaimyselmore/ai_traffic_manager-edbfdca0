import { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Planner } from '@/components/planner/Planner';
import { Agendas } from '@/components/agendas/Agendas';
import { mockEmployees } from '@/lib/mockData';

type Tab = 'overzicht' | 'planner' | 'agendas';

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
        return <Agendas />;
      default:
        return <Dashboard selectedEmployeeId={selectedEmployee} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
      />
      <div className="flex flex-1 flex-col">
        <TopBar
          selectedEmployee={selectedEmployee}
          onEmployeeChange={setSelectedEmployee}
        />
        <main className="flex-1 overflow-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Index;
