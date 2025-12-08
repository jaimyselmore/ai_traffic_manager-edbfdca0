import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { mockEmployees } from '@/lib/mockData';

export default function AgendaResultaat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedEmployee, setSelectedEmployee] = useState<string>(mockEmployees[0].id);
  const { employeeName, taskCount } = location.state || { employeeName: 'medewerker', taskCount: 0 };

  const handleBack = () => {
    navigate('/', { state: { activeTab: 'agendas' } });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar activeTab="agendas" onTabChange={() => {}} />
      <div className="flex flex-1 flex-col">
        <TopBar selectedEmployee={selectedEmployee} onEmployeeChange={setSelectedEmployee} />
        <main className="flex-1 p-6">
          {/* Back link */}
          <div className="mb-8">
            <button
              type="button"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              onClick={handleBack}
            >
              ← Terug naar agenda's
            </button>
          </div>

          {/* Success content */}
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <h1 className="text-2xl font-semibold text-foreground">
                Planning toegevoegd aan agenda
              </h1>
            </div>
            
            <p className="text-muted-foreground leading-relaxed">
              De geselecteerde planningsblokken ({taskCount} {taskCount === 1 ? 'blok' : 'blokken'}) zijn toegevoegd aan de agenda van {employeeName}. Bestaande afspraken in de agenda zijn niet aangepast.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
