import { Eye, Upload, CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AgendaCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}

function AgendaCard({ title, description, icon, onClick }: AgendaCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-6 text-left transition-all hover:shadow-md hover:border-primary/50 hover:bg-accent"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
        {icon}
      </div>
      <div>
        <h3 className="font-semibold text-base text-foreground">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </button>
  );
}

interface MicrosoftStatus {
  connected: boolean;
  connectedAt?: string;
  email?: string;
}

interface AgendasProps {
  onNavigate: (page: 'beschikbaarheid' | 'planning-plaatsen') => void;
}

export function Agendas({ onNavigate }: AgendasProps) {
  const [testEmployeeId] = useState('1'); // Test met eerste werknemer
  const [msStatus, setMsStatus] = useState<MicrosoftStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Check Microsoft connection status on mount
  useEffect(() => {
    checkMicrosoftStatus();
  }, []);

  // Check for OAuth callback success/error in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('microsoft_connected') === 'true') {
      setMessage('Microsoft account succesvol gekoppeld!');
      checkMicrosoftStatus();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      const error = params.get('error');
      setMessage(`Fout bij koppelen: ${error}`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const checkMicrosoftStatus = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/microsoft/status/${testEmployeeId}`);
      if (response.ok) {
        const data = await response.json();
        setMsStatus(data);
      } else {
        console.error('Failed to check Microsoft status');
      }
    } catch (error) {
      console.error('Error checking Microsoft status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectMicrosoft = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${API_BASE}/api/auth/microsoft/login/${testEmployeeId}`;
  };

  const handleDisconnectMicrosoft = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/microsoft/disconnect/${testEmployeeId}`, {
        method: 'POST',
      });
      if (response.ok) {
        setMessage('Microsoft account ontkoppeld');
        checkMicrosoftStatus();
      } else {
        setMessage('Fout bij ontkoppelen');
      }
    } catch (error) {
      console.error('Error disconnecting Microsoft:', error);
      setMessage('Fout bij ontkoppelen');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agenda's (Microsoft)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Werk met de Microsoft-agenda's van medewerkers: beschikbaarheid ophalen en planning plaatsen.
        </p>
      </div>

      {/* Microsoft Connection Test Card */}
      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">Microsoft Account Test</h2>

        {message && (
          <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : msStatus ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {msStatus.connected ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium">Microsoft account gekoppeld</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium">Geen Microsoft account gekoppeld</span>
                </>
              )}
            </div>

            {msStatus.connected && msStatus.email && (
              <p className="text-sm text-muted-foreground">
                Email: {msStatus.email}
              </p>
            )}

            {msStatus.connected && msStatus.connectedAt && (
              <p className="text-sm text-muted-foreground">
                Gekoppeld op: {new Date(msStatus.connectedAt).toLocaleString('nl-NL')}
              </p>
            )}

            <div className="pt-2">
              {msStatus.connected ? (
                <Button variant="destructive" onClick={handleDisconnectMicrosoft} disabled={loading}>
                  Ontkoppel Microsoft
                </Button>
              ) : (
                <Button onClick={handleConnectMicrosoft} disabled={loading}>
                  Koppel Microsoft Account
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Status niet beschikbaar</p>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
        <AgendaCard
          title="Beschikbaarheid medewerkers"
          description="Haal de beschikbaarheid van een medewerker op uit Microsoft-agenda's en bekijk 1–4 weken in een agenda-overzicht."
          icon={<Eye className="h-6 w-6 text-foreground" />}
          onClick={() => onNavigate('beschikbaarheid')}
        />
        <AgendaCard
          title="Planning plaatsen in Microsoft-agenda's"
          description="Plaats bevestigde planningsblokken in de Microsoft-agenda van een medewerker."
          icon={<Upload className="h-6 w-6 text-foreground" />}
          onClick={() => onNavigate('planning-plaatsen')}
        />
      </div>
    </div>
  );
}
