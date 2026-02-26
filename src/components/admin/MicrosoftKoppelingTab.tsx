import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Loader2, Unlink, Pencil, Check, X, AlertCircle, ExternalLink, Send, Copy, CheckCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { getMedewerkers } from '@/lib/data/adminService';

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
  const [medewerkerStatuses, setMedewerkerStatuses] = useState<MedewerkerStatus[]>([]);
  const [message, setMessage] = useState('');
  const [editingEmail, setEditingEmail] = useState<number | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const { toast } = useToast();

  // Load medewerkers using the same hook as WerknemersTab
  const { data: medewerkers = [], isLoading } = useQuery({
    queryKey: ['admin', 'medewerkers'],
    queryFn: getMedewerkers,
  });

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

  // Convert medewerkers to statuses when data loads
  useEffect(() => {
    if (medewerkers.length > 0) {
      const statuses: MedewerkerStatus[] = medewerkers
        .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
        .map((mw) => ({
          werknemer_id: mw.werknemer_id,
          naam_werknemer: mw.naam_werknemer,
          microsoft_email: (mw as any).microsoft_email || null,
          connected: false,
        }));
      setMedewerkerStatuses(statuses);

      // Load Microsoft status for each employee (optional - can fail silently)
      statuses.forEach(async (mw) => {
        try {
          const { data, error } = await supabase.functions.invoke('microsoft-status', {
            body: { werknemerId: String(mw.werknemer_id) },
          });
          if (!error && data) {
            setMedewerkerStatuses(prev =>
              prev.map(m =>
                m.werknemer_id === mw.werknemer_id
                  ? { ...m, connected: !!data.connected, connectedAt: data.connectedAt }
                  : m
              )
            );
          }
        } catch {
          // Silently ignore - microsoft-status might not be deployed
        }
      });
    }
  }, [medewerkers]);

  const handleDisconnect = async (werknemerId: number) => {
    setMedewerkerStatuses(prev =>
      prev.map(m => m.werknemer_id === werknemerId ? { ...m, loading: true } : m)
    );

    try {
      const { error } = await supabase.functions.invoke('microsoft-disconnect', {
        body: { werknemerId: String(werknemerId) },
      });

      if (error) {
        setMessage('Fout bij ontkoppelen');
      } else {
        setMedewerkerStatuses(prev =>
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
      setMedewerkerStatuses(prev =>
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
        setMedewerkerStatuses(prev =>
          prev.map(m =>
            m.werknemer_id === werknemerId
              ? { ...m, microsoft_email: email || null, invitationUrl: undefined }
              : m
          )
        );
        toast({ title: email ? 'E-mailadres opgeslagen' : 'E-mailadres verwijderd' });
        setEditingEmail(null);
        setEmailInput('');
      }
    } catch {
      setMessage('Fout bij opslaan e-mail');
    }
  };

  const generateInvitation = async (werknemerId: number, email: string) => {
    setMedewerkerStatuses(prev =>
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

      setMedewerkerStatuses(prev =>
        prev.map(m =>
          m.werknemer_id === werknemerId
            ? { ...m, invitationUrl: data.invitationUrl, invitationLoading: false, copiedLink: true }
            : m
        )
      );

      await navigator.clipboard.writeText(data.invitationUrl);
      toast({
        title: 'Link gekopieerd!',
        description: 'De uitnodigingslink is naar je klembord gekopieerd.',
      });

      setTimeout(() => {
        setMedewerkerStatuses(prev =>
          prev.map(m => m.werknemer_id === werknemerId ? { ...m, copiedLink: false } : m)
        );
      }, 3000);
    } catch {
      setMessage('Fout bij aanmaken uitnodiging');
    } finally {
      setMedewerkerStatuses(prev =>
        prev.map(m => m.werknemer_id === werknemerId ? { ...m, invitationLoading: false } : m)
      );
    }
  };

  const copyInvitationLink = async (werknemerId: number, url: string) => {
    await navigator.clipboard.writeText(url);
    setMedewerkerStatuses(prev =>
      prev.map(m => m.werknemer_id === werknemerId ? { ...m, copiedLink: true } : m)
    );
    toast({
      title: 'Link gekopieerd!',
      description: 'De uitnodigingslink is naar je klembord gekopieerd.',
    });
    setTimeout(() => {
      setMedewerkerStatuses(prev =>
        prev.map(m => m.werknemer_id === werknemerId ? { ...m, copiedLink: false } : m)
      );
    }, 3000);
  };

  const connectedCount = medewerkerStatuses.filter(m => m.connected).length;

  return (
    <div className="space-y-4">
      {/* Header - same style as KlantenTab */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{connectedCount}</span> / {medewerkerStatuses.length} medewerkers gekoppeld
        </div>
      </div>

      {message && (
        <Alert>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {/* Setup Guide - collapsible */}
      <Collapsible open={showSetupGuide} onOpenChange={setShowSetupGuide}>
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-800 dark:text-blue-300">Microsoft 365 integratie setup</AlertTitle>
          <AlertDescription className="text-blue-700 dark:text-blue-400">
            <p className="mt-1">
              Eenmalige Azure App Registration nodig. Daarna kunnen medewerkers via een link hun agenda koppelen.
            </p>
            <CollapsibleTrigger asChild>
              <Button variant="link" className="p-0 h-auto mt-2 text-blue-600 dark:text-blue-400">
                {showSetupGuide ? 'Verberg instructies' : 'Toon setup instructies →'}
              </Button>
            </CollapsibleTrigger>
          </AlertDescription>
        </Alert>
        <CollapsibleContent className="mt-4">
          <div className="rounded-lg border bg-card p-4 space-y-4 text-sm">
            <h4 className="font-semibold">Stap 1: Azure App Registration</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  Azure Portal - App Registrations <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>New registration → Naam: "Ellen Planning"</li>
              <li>Redirect URI: <code className="bg-muted px-1 rounded text-xs">{SUPABASE_URL}/functions/v1/microsoft-callback</code></li>
            </ol>

            <h4 className="font-semibold pt-2">Stap 2: Client Secret & Permissions</h4>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>Certificates & secrets → New client secret</li>
              <li>API permissions → Add: <code className="bg-muted px-1 rounded text-xs">Calendars.ReadWrite</code>, <code className="bg-muted px-1 rounded text-xs">offline_access</code></li>
            </ol>

            <h4 className="font-semibold pt-2">Stap 3: Supabase secrets</h4>
            <p className="text-muted-foreground">
              Voeg toe in{' '}
              <a href="https://supabase.com/dashboard/project/mrouohttlvirnvmdmwqj/settings/functions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Supabase Dashboard
              </a>:
              <code className="block bg-muted px-2 py-1 rounded text-xs mt-1">
                MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID, MICROSOFT_REDIRECT_URI
              </code>
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Table - same style as ProjectenTab */}
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-4">Medewerkers worden geladen...</div>
      ) : medewerkerStatuses.length === 0 ? (
        <div className="text-sm text-muted-foreground py-4">Geen medewerkers gevonden.</div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medewerker</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead className="w-[140px]">Status</TableHead>
                <TableHead className="w-[140px]">Gekoppeld op</TableHead>
                <TableHead className="w-[160px] text-right">Actie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medewerkerStatuses.map(mw => (
                <TableRow key={mw.werknemer_id}>
                  <TableCell className="font-medium">{mw.naam_werknemer}</TableCell>
                  <TableCell>
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
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEmail(mw.werknemer_id)}>
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEditEmail}>
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {mw.microsoft_email || <span className="italic opacity-50">Geen e-mail</span>}
                        </span>
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
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {mw.connectedAt
                      ? new Date(mw.connectedAt).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {mw.connected ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDisconnect(mw.werknemer_id)}
                        disabled={mw.loading}
                        className="text-destructive hover:text-destructive"
                      >
                        {mw.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Unlink className="h-4 w-4 mr-1" />Ontkoppel</>}
                      </Button>
                    ) : mw.microsoft_email ? (
                      mw.invitationUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyInvitationLink(mw.werknemer_id, mw.invitationUrl!)}
                          className="text-green-600 border-green-200 hover:bg-green-50"
                        >
                          {mw.copiedLink ? <><CheckCheck className="h-4 w-4 mr-1" />Gekopieerd!</> : <><Copy className="h-4 w-4 mr-1" />Kopieer link</>}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => generateInvitation(mw.werknemer_id, mw.microsoft_email!)}
                          disabled={mw.invitationLoading}
                        >
                          {mw.invitationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" />Uitnodiging</>}
                        </Button>
                      )
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Voer e-mail in</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
