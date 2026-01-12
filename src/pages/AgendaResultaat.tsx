import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/ui/button';

type SyncStatus = 'busy' | 'success' | 'error';

export default function AgendaResultaat() {
  const navigate = useNavigate();
  const location = useLocation();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('busy');
  
  const { employeeName, taskCount, weekNumber, employeeId } = location.state || { 
    employeeName: 'medewerker', 
    taskCount: 0,
    weekNumber: null,
    employeeId: null
  };

  // Simulate sync process
  useEffect(() => {
    const timer = setTimeout(() => {
      // 80% chance of success, 20% chance of error (for demo)
      const isSuccess = Math.random() > 0.2;
      setSyncStatus(isSuccess ? 'success' : 'error');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const handleBack = () => {
    navigate('/', { state: { activeTab: 'agendas' } });
  };

  const handleCancel = () => {
    // Cancel ongoing sync and go back
    navigate('/', { state: { activeTab: 'agendas' } });
  };

  const handleRetry = () => {
    setSyncStatus('busy');
    // Simulate retry
    setTimeout(() => {
      setSyncStatus('success');
    }, 2000);
  };

  const handleViewPlanner = () => {
    navigate('/', { state: { activeTab: 'planner' } });
  };

  return (
    <div className="h-full flex overflow-hidden bg-background">
      <AppSidebar activeTab="agendas" onTabChange={() => {}} />
      <div className="flex flex-1 flex-col h-full overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
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

          {/* Status content - centered */}
          <div className="flex justify-center">
            <div className="w-full max-w-lg">
              {/* Busy state */}
              {syncStatus === 'busy' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                    <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                  </div>
                  <h1 className="text-xl font-semibold text-blue-900 mb-2">
                    Ellen is aan het werk
                  </h1>
                  <p className="text-blue-700 mb-6">
                    Ellen is bezig om de geselecteerde planning aan de agenda toe te voegen. Dit kan even duren.
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={handleCancel}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    Actie annuleren
                  </Button>
                </div>
              )}

              {/* Success state */}
              {syncStatus === 'success' && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h1 className="text-xl font-semibold text-green-900 mb-2">
                    Planning toegevoegd aan de agenda
                  </h1>
                  <p className="text-green-700 mb-6">
                    De geselecteerde planningsblokken ({taskCount} {taskCount === 1 ? 'blok' : 'blokken'}) zijn succesvol toegevoegd aan de agenda van {employeeName}. Bestaande afspraken zijn niet aangepast.
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button 
                      variant="outline"
                      onClick={handleViewPlanner}
                      className="border-green-300 text-green-700 hover:bg-green-100"
                    >
                      Bekijk planner
                    </Button>
                    <Button 
                      onClick={handleBack}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Terug naar agenda's
                    </Button>
                  </div>
                </div>
              )}

              {/* Error state */}
              {syncStatus === 'error' && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <h1 className="text-xl font-semibold text-red-900 mb-2">
                    Toevoegen aan de agenda is niet gelukt
                  </h1>
                  <p className="text-red-700 mb-6">
                    Ellen kon de planning niet toevoegen aan de agenda. Probeer het later opnieuw of controleer de instellingen.
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button 
                      variant="outline"
                      onClick={handleBack}
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      Terug naar agenda's
                    </Button>
                    <Button 
                      onClick={handleRetry}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Opnieuw proberen
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
