import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Loader2, Link2, Unlink, Pencil, Check, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface MedewerkerStatus {
  werknemer_id: number;
  naam_werknemer: string;
  microsoft_email: string | null;
  connected: boolean;
  connectedAt?: string;
  loading?: boolean;
}

export function MicrosoftKoppelingTab() {
  const [medewerkers, setMedewerkers] = useState<MedewerkerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingEmail, setEditingEmail] = useState<number | null>(null);
  const [emailInput, setEmailInput] = useState('');

  // Check for OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('microsoft_connected') === 'true') {
      setMessage('Microsoft account succesvol gekoppeld!');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('error')) {
      setMessage(`Fout bij koppelen: ${params.get('error')}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Load all medewerkers and their Microsoft status
  useEffect(() => {
    loadMedewerkers();
  }, []);

  const loadMedewerkers = async () => {
    setLoading(true);
    try {
      // Get all medewerkers with in_planning = true
      const { data: mwData, error: mwError } = await supabase.functions.invoke('data-access', {
        body: { table: 'medewerkers', action: 'select' },
      });

      if (mwError || !mwData?.data) {
        console.error('Error loading medewerkers:', mwError);
        setLoading(false);
        return;
      }

      const allMw = (mwData.data as any[])
        .sort((a: any, b: any) => (a.display_order ?? 999) - (b.display_order ?? 999));

      // Map medewerkers to status objects (Microsoft integration not yet active)
      const statuses = allMw.map((mw: any) => ({
        werknemer_id: mw.werknemer_id,
        naam_werknemer: mw.naam_werknemer,
        microsoft_email: mw.microsoft_email || null,
        connected: false, // Will be checked when Microsoft integration is ready
      }));

      setMedewerkers(statuses);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (werknemerId: number) => {
    // Redirect to Microsoft OAuth - will come back to /admin page
    window.location.href = `${SUPABASE_URL}/functions/v1/microsoft-login/${werknemerId}`;
  };

  const handleDisconnect = async (werknemerId: number) => {
    setMedewerkers(prev =>
      prev.map(m => m.werknemer_id === werknemerId ? { ...m, loading: true } : m)
    );

    try {
      const { error } = await supabase.functions.invoke('microsoft-disconnect', {
        body: { werknemerId: String(werknemerId) },
      });

      if (error) {
        setMessage('Fout bij ontkoppelen');
      } else {
        setMedewerkers(prev =>
          prev.map(m =>
            m.werknemer_id === werknemerId
              ? { ...m, connected: false, connectedAt: undefined, loading: false }
              : m
          )
        );
        setMessage('Microsoft account ontkoppeld');
      }
    } catch {
      setMessage('Fout bij ontkoppelen');
    } finally {
      setMedewerkers(prev =>
        prev.map(m => m.werknemer_id === werknemerId ? { ...m, loading: false } : m)
      );
    }
  };

  const startEditEmail = (werknemerId: number, currentEmail: string | null) => {
    setEditingEmail(werknemerId);
    setEmailInput(currentEmail || '');
  };

  const cancelEditEmail = () => {
    setEditingEmail(null);
    setEmailInput('');
  };

  const saveEmail = async (werknemerId: number) => {
    const email = emailInput.trim();

    // Basic email validation
    if (email && !email.includes('@')) {
      setMessage('Voer een geldig e-mailadres in');
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('data-access', {
        body: {
          table: 'medewerkers',
          action: 'update',
          id: werknemerId,
          data: { microsoft_email: email || null },
        },
      });

      if (error) {
        setMessage('Fout bij opslaan e-mail');
      } else {
        setMedewerkers(prev =>
          prev.map(m =>
            m.werknemer_id === werknemerId
              ? { ...m, microsoft_email: email || null }
              : m
          )
        );
        setMessage(email ? 'E-mailadres opgeslagen' : 'E-mailadres verwijderd');
        setEditingEmail(null);
        setEmailInput('');
      }
    } catch {
      setMessage('Fout bij opslaan e-mail');
    }
  };

  const connectedCount = medewerkers.filter(m => m.connected).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Microsoft agenda koppelingen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Koppel de Microsoft-agenda's van medewerkers zodat Ellen beschikbaarheid kan checken en planning kan plaatsen.
        </p>
      </div>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Status overview */}
      <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
        <div className="text-sm">
          <span className="font-medium">{connectedCount}</span> van{' '}
          <span className="font-medium">{medewerkers.length}</span> medewerkers gekoppeld
        </div>
        {connectedCount === medewerkers.length && medewerkers.length > 0 && (
          <span className="text-xs text-green-600 font-medium">✓ Alles gekoppeld</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Laden...</span>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Medewerker</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">E-mail</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-4 py-3">Gekoppeld op</th>
                <th className="text-right text-sm font-medium text-muted-foreground px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {medewerkers.map(mw => (
                <tr key={mw.werknemer_id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{mw.naam_werknemer}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {editingEmail === mw.werknemer_id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="naam@bedrijf.nl"
                          className="h-8 w-48 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEmail(mw.werknemer_id);
                            if (e.key === 'Escape') cancelEditEmail();
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => saveEmail(mw.werknemer_id)}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={cancelEditEmail}
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{mw.microsoft_email || <span className="italic text-muted-foreground/70">Geen e-mail</span>}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-50 hover:opacity-100"
                          onClick={() => startEditEmail(mw.werknemer_id, mw.microsoft_email)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {mw.connected ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-700 dark:text-green-400">Gekoppeld</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Niet gekoppeld</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {mw.connectedAt
                      ? new Date(mw.connectedAt).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {mw.connected ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(mw.werknemer_id)}
                        disabled={mw.loading}
                        className="text-destructive hover:text-destructive"
                      >
                        {mw.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Unlink className="h-4 w-4 mr-1" />
                            Ontkoppel
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConnect(mw.werknemer_id)}
                        disabled={mw.loading}
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        Koppel
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
