import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { Planner } from '@/components/planner/Planner';
import { OutlookSync } from '@/components/outlook/OutlookSync';

type Tab = 'overzicht' | 'planner' | 'outlook';

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>('overzicht');

  const renderContent = () => {
    switch (activeTab) {
      case 'overzicht':
        return <Dashboard />;
      case 'planner':
        return <Planner />;
      case 'outlook':
        return <OutlookSync />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderContent()}
    </AppLayout>
  );
};

export default Index;
