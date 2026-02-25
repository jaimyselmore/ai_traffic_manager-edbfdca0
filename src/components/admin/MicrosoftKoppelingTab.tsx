import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Loader2, Unlink, Pencil, Check, X, AlertCircle, ExternalLink, Send, Copy, CheckCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

interface MedewerkerStatus {
  werknemer_id: number;
  naam_werknemer: string;
  microsoft_email: string | null;
  connected: boolean;
  connectedAt?: string;
  loading?: boolean;
  invitationUrl?: string;
  invitationLoading?: boolean;
  copiedLink?: boolean;
}

export function MicrosoftKoppelingTab() {
  const [medewerkers, setMedewerkers] = useState<MedewerkerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [editingEmail, setEditingEmail] = useState<number | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const { toast } = useToast();

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

      // Basisstatus zonder Microsoft-informatie
      const baseStatuses: MedewerkerStatus[] = allMw.map((mw: any) => ({
        werknemer_id: mw.werknemer_id,
        naam_werknemer: mw.naam_werknemer,
        microsoft_email: mw.microsoft_email || null,
        connected: false,
      }));

      // Verrijk met actuele Microsoft-status op basis van microsoft_tokens tabel
      const withStatus = await Promise.all(
        baseStatuses.map(async (mw) => {
          try {
            const { data, error } = await supabase.functions.invoke('microsoft-status', {
              body: { werknemerId: String(mw.werknemer_id) },
            });

            if (!error && data) {
              return {
                ...mw,
                connected: !!data.connected,
                connectedAt: data.connectedAt || undefined,
              };
            }
          } catch (err) {
            console.error('Error loading Microsoft status for', mw.werknemer_id, err);
          }
          return mw;
        })
      );

      setMedewerkers(withStatus);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
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
              ? { ...m, microsoft_email: email || null, invitationUrl: undefined }
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

  const generateInvitation = async (werknemerId: number, email: string) => {
    setMedewerkers(prev =>
      prev.map(m => m.werknemer_id === werknemerId ? { ...m, invitationLoading: true } : m)
    );

    try {
      const appUrl = window.location.origin;
      const { data, error } = await supabase.functions.invoke('microsoft-invite', {
        body: { werknemerId, email, appUrl },
      });

      if (error || !data?.invitationUrl) {
        setMessage('Fout bij aanmaken uitnodiging');
        return;
      }

      setMedewerkers(prev =>
        prev.map(m =>
          m.werknemer_id === werknemerId
            ? { ...m, invitationUrl: data.invitationUrl, invitationLoading: false }
            : m
        )
      );

      // Auto-copy to clipboard
      await navigator.clipboard.writeText(data.invitationUrl);
      toast({
        title: 'Link gekopieerd!',
        description: 'De uitnodigingslink is naar je klembord gekopieerd.',
      });

      setMedewerkers(prev =>
        prev.map(m =>
          m.werknemer_id === werknemerId ? { ...m, copiedLink: true } : m
        )
      );

      // Reset copied state after 3 seconds
      setTimeout(() => {
        setMedewerkers(prev =>
          prev.map(m =>
            m.werknemer_id === werknemerId ? { ...m, copiedLink: false } : m
          )
        );
      }, 3000);

    } catch {
      setMessage('Fout bij aanmaken uitnodiging');
    } finally {
      setMedewerkers(prev =>
        prev.map(m => m.werknemer_id === werknemerId ? { ...m, invitationLoading: false } : m)
      );
    }
  };

  const copyInvitationLink = async (werknemerId: number, url: string) => {
    await navigator.clipboard.writeText(url);
    setMedewerkers(prev =>
      prev.map(m =>
        m.werknemer_id === werknemerId ? { ...m, copiedLink: true } : m
      )
    );

    toast({
      title: 'Link gekopieerd!',
      description: 'De uitnodigingslink is naar je klembord gekopieerd.',
    });

    setTimeout(() => {
      setMedewerkers(prev =>
        prev.map(m =>
          m.werknemer_id === werknemerId ? { ...m, copiedLink: false } : m
        )
      );
    }, 3000);
  };

  const connectedCount = medewerkers.filter(m => m.connected).length;
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Microsoft agenda koppelingen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Koppel de Microsoft-agenda's van medewerkers zodat Ellen beschikbaarheid kan checken en planning kan plaatsen.
          Voer het e-mailadres van elke medewerker in en stuur ze een uitnodigingslink.
        </p>
      </div>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Setup Guide */}
      <Collapsible open={showSetupGuide} onOpenChange={setShowSetupGuide}>
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-300">Microsoft 365 integratie setup</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            <p className="mt-1">
              Om Microsoft agenda's te koppelen moet eerst een Azure App Registration worden aangemaakt.
              Dit hoeft maar één keer - daarna kunnen alle medewerkers hun account koppelen via OAuth (geen wachtwoorden nodig).
            </p>
            <CollapsibleTrigger asChild>
              <Button variant="link" className="p-0 h-auto mt-2 text-blue-600 dark:text-blue-400">
                {showSetupGuide ? 'Verberg setup instructies' : 'Toon setup instructies →'}
              </Button>
            </CollapsibleTrigger>
          </AlertDescription>
        </Alert>
        <CollapsibleContent className="mt-4">
          <div className="rounded-lg border bg-card p-4 space-y-4 text-sm">
            <h4 className="font-semibold">Stap 1: Azure App Registration aanmaken</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                Ga naar{' '}
                <a
                  href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Azure Portal - App Registrations
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Klik op "New registration"</li>
              <li>Naam: "Ellen Planning" (of iets vergelijkbaars)</li>
              <li>Supported account types: "Accounts in this organizational directory only" (single tenant)</li>
              <li>Redirect URI: Web - <code className="bg-muted px-1 rounded text-xs">{SUPABASE_URL}/functions/v1/microsoft-callback</code></li>
              <li>Klik "Register"</li>
            </ol>

            <h4 className="font-semibold pt-2">Stap 2: Client Secret aanmaken</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>In je nieuwe app, ga naar "Certificates & secrets"</li>
              <li>Klik "New client secret"</li>
              <li>Beschrijving: "Ellen Planning", Expiry: 24 months</li>
              <li>Kopieer de secret VALUE (niet de ID) - je ziet dit maar één keer!</li>
            </ol>

            <h4 className="font-semibold pt-2">Stap 3: API Permissions toevoegen</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Ga naar "API permissions"</li>
              <li>Klik "Add a permission" → Microsoft Graph → Delegated permissions</li>
              <li>Voeg toe: <code className="bg-muted px-1 rounded text-xs">User.Read</code>, <code className="bg-muted px-1 rounded text-xs">Calendars.ReadWrite</code>, <code className="bg-muted px-1 rounded text-xs">offline_access</code></li>
              <li>Klik "Grant admin consent" (optioneel, maar handig)</li>
            </ol>

            <h4 className="font-semibold pt-2">Stap 4: Supabase secrets configureren</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                Ga naar{' '}
                <a
                  href="https://supabase.com/dashboard/project/mrouohttlvirnvmdmwqj/settings/functions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Supabase Dashboard - Edge Functions
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>Voeg deze secrets toe:
                <ul className="list-disc list-inside ml-4 mt-1">
                  <li><code className="bg-muted px-1 rounded text-xs">MICROSOFT_CLIENT_ID</code> - Application (client) ID van je Azure app</li>
                  <li><code className="bg-muted px-1 rounded text-xs">MICROSOFT_CLIENT_SECRET</code> - De secret value uit stap 2</li>
                  <li><code className="bg-muted px-1 rounded text-xs">MICROSOFT_TENANT_ID</code> - Directory (tenant) ID van je Azure app</li>
                  <li><code className="bg-muted px-1 rounded text-xs">MICROSOFT_REDIRECT_URI</code> - <code className="bg-muted px-1 rounded text-xs">{SUPABASE_URL}/functions/v1/microsoft-callback</code></li>
                </ul>
              </li>
            </ol>

            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
              <p className="text-green-800 dark:text-green-300 text-sm">
                <strong>Na deze setup:</strong> Voer het e-mailadres van elke medewerker in en klik op "Maak uitnodiging".
                Kopieer de link en stuur deze naar de medewerker. Zij kunnen dan zelf hun Microsoft account koppelen - zonder in te loggen op dit platform.
              </p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

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
                    ) : mw.microsoft_email ? (
                      <div className="flex items-center gap-2">
                        {mw.invitationUrl ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyInvitationLink(mw.werknemer_id, mw.invitationUrl!)}
                            className="text-green-600 border-green-200 hover:bg-green-50"
                          >
                            {mw.copiedLink ? (
                              <>
                                <CheckCheck className="h-4 w-4 mr-1" />
                                Gekopieerd!
                              </>
                            ) : (
                              <>
                                <Copy className="h-4 w-4 mr-1" />
                                Kopieer link
                              </>
                            )}
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => generateInvitation(mw.werknemer_id, mw.microsoft_email!)}
                            disabled={mw.invitationLoading}
                          >
                            {mw.invitationLoading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-1" />
                                Maak uitnodiging
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Voer eerst e-mail in
                      </span>
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
