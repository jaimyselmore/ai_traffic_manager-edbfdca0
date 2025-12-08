import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { TopBar } from '@/components/layout/TopBar';
import { mockEmployees } from '@/lib/mockData';

export default function EllenWorking() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedEmployee] = useState<string>(mockEmployees[0].id);
  const { requestType } = location.state || { requestType: 'verzoek' };

  const handleBack = () => {
    navigate('/');
  };

  const getSubtext = () => {
    switch (requestType) {
      case 'project':
        return 'Ellen bekijkt je nieuwe project en maakt een voorstel voor de planning. Je kunt dit zo terugvinden in de planner.';
      case 'wijziging':
        return 'Ellen bekijkt je wijzigingsverzoek en past de planning aan. Je kunt de wijzigingen zo terugvinden in de planner.';
      case 'meeting':
        return 'Ellen plant je meeting in en controleert de beschikbaarheid. Je kunt dit zo terugvinden in de planner.';
      case 'verlof':
        return 'Ellen verwerkt de beschikbaarheid en past de planning aan. Je kunt dit zo terugvinden in de planner.';
      default:
        return 'Ellen bekijkt je aanvraag en maakt een voorstel voor de planning. Je kunt dit zo terugvinden in de planner.';
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar activeTab="overzicht" onTabChange={() => {}} />
      <div className="flex flex-1 flex-col">
        <TopBar selectedEmployee={selectedEmployee} onEmployeeChange={() => {}} />
        <main className="flex-1 p-6">
          {/* Back link */}
          <div className="mb-8">
            <button
              type="button"
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
              onClick={handleBack}
            >
              ← Terug naar overzicht
            </button>
          </div>

          {/* Main content */}
          <div className="max-w-xl">
            {/* Ellen avatar */}
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                  E
                </div>
                {/* Animated pulse ring */}
                <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-foreground">
                  Ellen is aan het werk
                </h1>
              </div>
            </div>
            
            <p className="text-muted-foreground leading-relaxed mb-6">
              {getSubtext()}
            </p>

            <p className="text-sm text-muted-foreground/70 italic">
              Laat dit scherm gerust open; Ellen werkt op de achtergrond verder.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
